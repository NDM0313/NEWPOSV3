import React, { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  Edit2,
  FileText,
  DollarSign,
  CreditCard,
  Wallet,
  TrendingUp,
  TrendingDown,
  Search,
  MoreVertical,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  BarChart3,
  AlertCircle,
  LayoutGrid,
  List,
  Receipt,
  Zap,
  FileSpreadsheet,
  Cog,
  Eye,
  EyeOff,
  Clock,
  Trash2,
  History,
  Power,
  PowerOff,
  Lock,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { Switch } from '@/app/components/ui/switch';
import { cn } from '@/app/components/ui/utils';
import { toast } from 'sonner';
import { useChartAccounts } from '@/app/hooks/useChartAccounts';
import { ChartAccount, AccountCategory } from '@/app/services/chartAccountService';
import { AddChartAccountDrawer } from '@/app/components/accounting/AddChartAccountDrawer';
import * as Tabs from '@radix-ui/react-tabs';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type MainTab = 'overview' | 'chart-of-accounts' | 'transactions' | 'automation' | 'reports' | 'settings';

// ============================================================================
// CONSTANTS
// ============================================================================

const categoryConfig: Record<AccountCategory, {
  color: string;
  icon: React.ElementType;
  bgClass: string;
  borderClass: string;
  textClass: string;
  hoverClass: string;
  activeClass: string;
}> = {
  'Assets': {
    color: 'blue',
    icon: Wallet,
    bgClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/30',
    textClass: 'text-blue-400',
    hoverClass: 'hover:bg-blue-500/20',
    activeClass: 'bg-blue-500/20 border-blue-400',
  },
  'Liabilities': {
    color: 'red',
    icon: TrendingDown,
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/30',
    textClass: 'text-red-400',
    hoverClass: 'hover:bg-red-500/20',
    activeClass: 'bg-red-500/20 border-red-400',
  },
  'Equity': {
    color: 'purple',
    icon: Shield,
    bgClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/30',
    textClass: 'text-purple-400',
    hoverClass: 'hover:bg-purple-500/20',
    activeClass: 'bg-purple-500/20 border-purple-400',
  },
  'Income': {
    color: 'green',
    icon: TrendingUp,
    bgClass: 'bg-green-500/10',
    borderClass: 'border-green-500/30',
    textClass: 'text-green-400',
    hoverClass: 'hover:bg-green-500/20',
    activeClass: 'bg-green-500/20 border-green-400',
  },
  'Cost of Sales': {
    color: 'yellow',
    icon: BarChart3,
    bgClass: 'bg-yellow-500/10',
    borderClass: 'border-yellow-500/30',
    textClass: 'text-yellow-400',
    hoverClass: 'hover:bg-yellow-500/20',
    activeClass: 'bg-yellow-500/20 border-yellow-400',
  },
  'Expenses': {
    color: 'orange',
    icon: AlertCircle,
    bgClass: 'bg-orange-500/10',
    borderClass: 'border-orange-500/30',
    textClass: 'text-orange-400',
    hoverClass: 'hover:bg-orange-500/20',
    activeClass: 'bg-orange-500/20 border-orange-400',
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const AccountingChartTestPage: React.FC = () => {
  // Backend integration
  const {
    accounts: backendAccounts,
    loading,
    error: hookError,
    createAccount,
    updateAccount,
    deleteAccount,
    toggleActive,
    fetchAccounts,
  } = useChartAccounts();

  // State
  const [mainTab, setMainTab] = useState<MainTab>('overview');
  const [coaSubTab, setCoaSubTab] = useState<AccountCategory>('Assets');
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<ChartAccount | null>(null);
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);

  // Calculate summary
  const summary = useMemo(() => {
    const filteredAccounts = showInactive ? backendAccounts : backendAccounts.filter(a => a.active);

    return {
      totalAssets: filteredAccounts.filter(a => a.category === 'Assets').reduce((sum, a) => sum + (a.current_balance || 0), 0),
      totalLiabilities: filteredAccounts.filter(a => a.category === 'Liabilities').reduce((sum, a) => sum + (a.current_balance || 0), 0),
      totalEquity: filteredAccounts.filter(a => a.category === 'Equity').reduce((sum, a) => sum + (a.current_balance || 0), 0),
      totalIncome: filteredAccounts.filter(a => a.category === 'Income').reduce((sum, a) => sum + (a.current_balance || 0), 0),
      totalAccounts: filteredAccounts.length,
      activeAccounts: backendAccounts.filter(a => a.active).length,
      lastUpdated: new Date().toLocaleString(),
    };
  }, [backendAccounts, showInactive]);

  // Group accounts by sub-category
  const groupedAccountsByCategory = useMemo(() => {
    const filtered = backendAccounts.filter(acc => {
      const matchesSearch = searchTerm === '' ||
        acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.code.includes(searchTerm);
      const matchesActive = showInactive || acc.active;
      return matchesSearch && acc.category === coaSubTab && matchesActive;
    });

    const grouped: Record<string, ChartAccount[]> = {};
    filtered.forEach(acc => {
      if (!grouped[acc.sub_category]) {
        grouped[acc.sub_category] = [];
      }
      grouped[acc.sub_category].push(acc);
    });

    return grouped;
  }, [backendAccounts, searchTerm, coaSubTab, showInactive]);

  // Handlers
  const handleOpenAddDrawer = useCallback((editAccount?: ChartAccount) => {
    setSelectedAccount(editAccount || null);
    setIsAddDrawerOpen(true);
  }, []);

  const handleSaveAccount = useCallback(async (account: ChartAccount) => {
    try {
      if (account.id) {
        await updateAccount(account.id, account);
      } else {
        await createAccount(account);
      }
      setIsAddDrawerOpen(false);
      setSelectedAccount(null);
      await fetchAccounts();
    } catch (error: any) {
      console.error('[ACCOUNTING TEST PAGE] Error saving account:', error);
      toast.error('Failed to save account', { description: error.message });
    }
  }, [createAccount, updateAccount, fetchAccounts]);

  const handleDeleteAccount = useCallback(async () => {
    if (!deleteAccountId) return;

    try {
      const account = backendAccounts.find(a => a.id === deleteAccountId);
      const success = await deleteAccount(deleteAccountId);
      if (success) {
        setDeleteAccountId(null);
        setSelectedAccount(null);
        await fetchAccounts();
      }
    } catch (error: any) {
      console.error('[ACCOUNTING TEST PAGE] Error deleting account:', error);
      toast.error('Failed to delete account', { description: error.message });
    }
  }, [deleteAccountId, deleteAccount, fetchAccounts, backendAccounts]);

  const handleToggleActive = useCallback(async (account: ChartAccount) => {
    try {
      await toggleActive(account.id!, !account.active);
      await fetchAccounts();
    } catch (error: any) {
      console.error('[ACCOUNTING TEST PAGE] Error toggling active:', error);
      toast.error('Failed to update account status', { description: error.message });
    }
  }, [toggleActive, fetchAccounts]);

  return (
    <div className="h-screen flex flex-col bg-[#0B0F19]">
      {/* HEADER */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-800 bg-[#111827]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Chart of Accounts (TEST)</h1>
            <p className="text-sm text-gray-400 mt-1">
              Fully Functional ERP Accounting System • Last Updated: {summary.lastUpdated}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="bg-blue-600 hover:bg-blue-500 text-white"
              onClick={() => handleOpenAddDrawer()}
            >
              <Plus className="h-4 w-4 mr-2" />Add New Account
            </Button>
          </div>
        </div>
      </div>

      {/* MAIN TABS */}
      <Tabs.Root value={mainTab} onValueChange={(value) => setMainTab(value as MainTab)} className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 border-b border-gray-800 bg-[#111827]">
          <Tabs.List className="flex items-center px-6 gap-1">
            {[
              { value: 'overview', icon: LayoutGrid, label: 'Overview' },
              { value: 'chart-of-accounts', icon: List, label: 'Chart of Accounts' },
              { value: 'transactions', icon: Receipt, label: 'Transactions', badge: '5' },
              { value: 'automation', icon: Zap, label: 'Automation', badge: '4/4' },
              { value: 'reports', icon: FileSpreadsheet, label: 'Reports' },
              { value: 'settings', icon: Cog, label: 'Settings' },
            ].map(({ value, icon: Icon, label, badge }) => (
              <Tabs.Trigger
                key={value}
                value={value}
                className={cn(
                  "px-4 py-3 text-sm font-medium transition-all relative flex items-center gap-2",
                  mainTab === value ? "text-blue-400 border-b-2 border-blue-400" : "text-gray-400 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {badge && (
                  <Badge variant="outline" className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
                    {badge}
                  </Badge>
                )}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </div>

        {/* TAB CONTENT */}
        <div className="flex-1 overflow-hidden">
          {/* OVERVIEW TAB */}
          <Tabs.Content value="overview" className="h-full overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">Accounting Summary</h2>

              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                {[
                  {
                    category: 'Assets',
                    value: summary.totalAssets,
                    icon: ArrowUpRight,
                    trend: '+12%',
                    config: categoryConfig.Assets,
                    count: backendAccounts.filter(a => a.category === 'Assets' && a.active).length,
                  },
                  {
                    category: 'Liabilities',
                    value: summary.totalLiabilities,
                    icon: ArrowDownRight,
                    trend: '-5%',
                    config: categoryConfig.Liabilities,
                    count: backendAccounts.filter(a => a.category === 'Liabilities' && a.active).length,
                  },
                  {
                    category: 'Equity',
                    value: summary.totalEquity,
                    icon: Shield,
                    trend: '+8%',
                    config: categoryConfig.Equity,
                    count: backendAccounts.filter(a => a.category === 'Equity' && a.active).length,
                  },
                  {
                    category: 'Income',
                    value: summary.totalIncome,
                    icon: TrendingUp,
                    trend: '+15%',
                    config: categoryConfig.Income,
                    count: backendAccounts.filter(a => a.category === 'Income' && a.active).length,
                  },
                ].map(({ category, value, icon: Icon, trend, config, count }) => (
                  <div
                    key={category}
                    className={cn(
                      "rounded-lg p-4 cursor-pointer border transition-all",
                      config.bgClass,
                      config.borderClass,
                      "hover:shadow-lg"
                    )}
                    onClick={() => {
                      setMainTab('chart-of-accounts');
                      setCoaSubTab(category as AccountCategory);
                    }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn("p-2 rounded-lg", config.bgClass)}>
                        <Icon className={cn("h-5 w-5", config.textClass)} />
                      </div>
                      <p className={cn("text-xs uppercase tracking-wider font-semibold", config.textClass)}>
                        Total {category}
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-white">Rs. {value.toLocaleString()}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-400">{count} accounts</p>
                      <Badge variant="outline" className={cn("text-xs", config.textClass, config.borderClass)}>
                        {trend}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Actions */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-white mb-3">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    className="justify-start h-auto py-4 bg-gray-800 hover:bg-gray-700 text-white border border-gray-700"
                    onClick={() => handleOpenAddDrawer()}
                  >
                    <Plus className="h-5 w-5 mr-3 text-blue-400" />
                    <div className="text-left">
                      <div className="font-semibold">Add New Account</div>
                      <div className="text-xs text-gray-400">Create new chart of account entry</div>
                    </div>
                  </Button>
                  <Button
                    className="justify-start h-auto py-4 bg-gray-800 hover:bg-gray-700 text-white border border-gray-700"
                    onClick={() => setMainTab('transactions')}
                  >
                    <FileText className="h-5 w-5 mr-3 text-green-400" />
                    <div className="text-left">
                      <div className="font-semibold">Add Journal Entry</div>
                      <div className="text-xs text-gray-400">Manual accounting entry</div>
                    </div>
                  </Button>
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Recent Activity</h3>
                <div className="bg-gray-800 border border-gray-700 rounded-lg">
                  <div className="p-8 text-center text-gray-500">No activity yet</div>
                </div>
              </div>
            </div>
          </Tabs.Content>

          {/* CHART OF ACCOUNTS TAB */}
          <Tabs.Content value="chart-of-accounts" className="h-full flex flex-col overflow-hidden">
            {/* Category Filters */}
            <div className="shrink-0 border-b border-gray-800 bg-[#0B0F19] px-6 py-3">
              <div className="flex items-center gap-2">
                {Object.entries(categoryConfig).map(([category, config]) => {
                  const Icon = config.icon;
                  const count = backendAccounts.filter(
                    a => a.category === category && (showInactive || a.active)
                  ).length;
                  return (
                    <button
                      key={category}
                      onClick={() => setCoaSubTab(category as AccountCategory)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 border",
                        coaSubTab === category
                          ? cn(config.activeClass, config.textClass)
                          : "text-gray-400 hover:text-white bg-gray-800/50 border-gray-700 hover:bg-gray-800"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {category}
                      <Badge variant="outline" className="text-xs ml-1">{count}</Badge>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search Bar */}
            <div className="shrink-0 p-4 border-b border-gray-800 bg-[#0B0F19] flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder={`Search ${coaSubTab} accounts...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Show Inactive</span>
                <Switch
                  checked={showInactive}
                  onCheckedChange={setShowInactive}
                  className="data-[state=checked]:bg-blue-600"
                />
              </div>
            </div>

            {/* Accounts List */}
            <div className="flex-1 overflow-y-auto p-6">
              {Object.keys(groupedAccountsByCategory).length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 mb-1">No accounts found in {coaSubTab}</p>
                  {hookError && (hookError.includes('does not exist') || hookError.includes('relation')) ? (
                    <p className="text-xs text-amber-400 mt-2">
                      Database table not found. Please run the migration:
                      <br />
                      <code className="text-xs bg-gray-800 px-2 py-1 rounded mt-1 inline-block">
                        supabase-extract/migrations/16_chart_of_accounts.sql
                      </code>
                    </p>
                  ) : (
                    <Button
                      className="mt-4 bg-blue-600 hover:bg-blue-500"
                      onClick={() => handleOpenAddDrawer()}
                    >
                      <Plus className="h-4 w-4 mr-2" />Add First Account
                    </Button>
                  )}
                </div>
              ) : (
                Object.entries(groupedAccountsByCategory).map(([subCategory, accs]) => (
                  <div key={subCategory} className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-400 mb-3 px-2 uppercase tracking-wider">
                      {subCategory}
                    </h4>
                    <div className="space-y-2">
                      {accs.map((account) => {
                        const config = categoryConfig[account.category];
                        return (
                          <div
                            key={account.id}
                            className={cn(
                              "p-4 rounded-lg border transition-all group",
                              config.bgClass,
                              config.borderClass,
                              "hover:shadow-lg",
                              !account.active && "opacity-50"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="font-mono text-xs text-gray-400 bg-gray-900/50 px-2 py-1 rounded">
                                    {account.code}
                                  </span>
                                  <span className="font-semibold text-white">{account.name}</span>
                                  {!account.active && (
                                    <Badge variant="outline" className="text-gray-500 border-gray-600">
                                      Inactive
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-gray-400">
                                  <span className="flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" />
                                    Current: Rs. {(account.current_balance || 0).toLocaleString()}
                                  </span>
                                  <span
                                    className={cn(
                                      "px-2 py-0.5 rounded",
                                      account.nature === 'Debit'
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : 'bg-green-500/20 text-green-400'
                                    )}
                                  >
                                    {account.nature}
                                  </span>
                                </div>
                              </div>

                              {/* THREE-DOTS MENU */}
                              <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Portal>
                                  <DropdownMenu.Content
                                    className="min-w-[200px] bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-1 z-50"
                                    sideOffset={5}
                                  >
                                    <DropdownMenu.Item
                                      className={cn(
                                        "flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer outline-none",
                                        account.is_system
                                          ? "text-gray-500 cursor-not-allowed opacity-50"
                                          : "text-gray-300 hover:text-white hover:bg-gray-700"
                                      )}
                                      onClick={() => {
                                        if (!account.is_system) {
                                          handleOpenAddDrawer(account);
                                        }
                                      }}
                                      disabled={account.is_system}
                                    >
                                      <Edit2 className="h-4 w-4" />Edit Account
                                      {account.is_system && (
                                        <span className="text-xs text-amber-400 ml-auto">(Protected)</span>
                                      )}
                                    </DropdownMenu.Item>
                                    {!account.is_system && (
                                      <DropdownMenu.Item
                                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded cursor-pointer outline-none"
                                        onClick={() => handleToggleActive(account)}
                                      >
                                        {account.active ? (
                                          <>
                                            <PowerOff className="h-4 w-4" />Deactivate
                                          </>
                                        ) : (
                                          <>
                                            <Power className="h-4 w-4" />Activate
                                          </>
                                        )}
                                      </DropdownMenu.Item>
                                    )}
                                    {!account.is_system && (
                                      <>
                                        <DropdownMenu.Separator className="h-px bg-gray-700 my-1" />
                                        <DropdownMenu.Item
                                          className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded cursor-pointer outline-none"
                                          onClick={() => setDeleteAccountId(account.id || null)}
                                        >
                                          <Trash2 className="h-4 w-4" />Delete Account
                                        </DropdownMenu.Item>
                                      </>
                                    )}
                                    {account.is_system && (
                                      <DropdownMenu.Item
                                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 cursor-not-allowed opacity-50 rounded outline-none"
                                        disabled
                                      >
                                        <Lock className="h-4 w-4" />System Account (Protected)
                                      </DropdownMenu.Item>
                                    )}
                                  </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                              </DropdownMenu.Root>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Tabs.Content>

          {/* TRANSACTIONS TAB */}
          <Tabs.Content value="transactions" className="h-full overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">Transactions</h2>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-12 text-center">
                <Receipt className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg mb-2">No Transactions Yet</p>
              </div>
            </div>
          </Tabs.Content>

          {/* AUTOMATION TAB */}
          <Tabs.Content value="automation" className="h-full overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">Automation</h2>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-12 text-center">
                <Zap className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg mb-2">No Automation Rules Yet</p>
              </div>
            </div>
          </Tabs.Content>

          {/* REPORTS TAB */}
          <Tabs.Content value="reports" className="h-full overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">Reports</h2>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-12 text-center">
                <FileSpreadsheet className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg mb-2">No Reports Available</p>
              </div>
            </div>
          </Tabs.Content>

          {/* SETTINGS TAB */}
          <Tabs.Content value="settings" className="h-full overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">Settings</h2>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-12 text-center">
                <Cog className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg mb-2">Settings Coming Soon</p>
              </div>
            </div>
          </Tabs.Content>
        </div>
      </Tabs.Root>

      {/* Add/Edit Account Drawer */}
      <AddChartAccountDrawer
        open={isAddDrawerOpen}
        onOpenChange={setIsAddDrawerOpen}
        account={selectedAccount}
        onSave={handleSaveAccount}
        onClose={() => {
          setIsAddDrawerOpen(false);
          setSelectedAccount(null);
        }}
        allAccounts={backendAccounts}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteAccountId} onOpenChange={(open) => !open && setDeleteAccountId(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Account</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to delete this account? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700 text-gray-300 hover:bg-gray-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400 mx-auto mb-2"></div>
            <p className="text-white text-sm">Loading accounts...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountingChartTestPage;
