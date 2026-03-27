import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  Copy,
  Eye,
  FileText,
  FolderPlus,
  MoreVertical,
  PanelTop,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { AccountsHierarchyList } from '@/app/components/accounting/AccountsHierarchyList';
import { useAccountsHierarchyModel } from '@/app/components/accounting/useAccountsHierarchyModel';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { useAccounting } from '@/app/context/AccountingContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { toast } from 'sonner';
import type { Account } from '@/app/context/AccountingContext';

/** Static tree + journal touches to preview hierarchy UI without touching production data. */
const MOCK_ACCOUNTS = [
  {
    id: 'mock-root-assets',
    name: 'Assets',
    type: 'asset',
    accountType: 'asset',
    code: '1000',
    balance: 850_000,
    isActive: true,
    parent_id: null,
  },
  {
    id: 'mock-cash-group',
    name: 'Cash & Cash Equivalents',
    type: 'cash',
    accountType: 'cash',
    code: '1010',
    balance: 320_000,
    isActive: true,
    parent_id: 'mock-root-assets',
  },
  {
    id: 'mock-petty',
    name: 'Petty Cash',
    type: 'cash',
    accountType: 'cash',
    code: '1001',
    balance: 45_000,
    isActive: true,
    parent_id: 'mock-cash-group',
  },
  {
    id: 'mock-bank-group',
    name: 'Bank Accounts',
    type: 'bank',
    accountType: 'bank',
    code: '1011',
    balance: 485_000,
    isActive: true,
    parent_id: 'mock-root-assets',
  },
  {
    id: 'mock-root-liab',
    name: 'Liabilities',
    type: 'liability',
    accountType: 'liability',
    code: '2000',
    balance: 210_000,
    isActive: true,
    parent_id: null,
  },
  {
    id: 'mock-ap',
    name: 'Accounts Payable',
    type: 'payable',
    accountType: 'payable',
    code: '2010',
    balance: 210_000,
    isActive: true,
    parent_id: 'mock-root-liab',
  },
] as Account[];

function mockJournalTouches(names: string[]) {
  return Array.from({ length: 120 }, (_, i) => ({
    debitAccount: names[i % names.length],
    creditAccount: names[(i + 1) % names.length],
  }));
}

const MOCK_TOUCHES = mockJournalTouches([
  'Assets',
  'Cash & Cash Equivalents',
  'Petty Cash',
  'Bank Accounts',
  'Liabilities',
  'Accounts Payable',
]);

export const AccountsHierarchyTestPage = () => {
  const { formatCurrency } = useFormatCurrency();
  const accounting = useAccounting();
  const [source, setSource] = useState<'mock' | 'live'>('mock');
  const [accountsViewMode, setAccountsViewMode] = useState<'operational' | 'professional'>('professional');
  const [showSubAccounts, setShowSubAccounts] = useState(true);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());

  const accounts = source === 'live' ? accounting.accounts : MOCK_ACCOUNTS;
  const journalTouches = source === 'live' ? accounting.entries : MOCK_TOUCHES;

  const { hierarchyRows } = useAccountsHierarchyModel(
    accounts as Account[],
    journalTouches,
    accountsViewMode,
    showSubAccounts,
    collapsedGroupIds,
    setCollapsedGroupIds
  );

  const demoTrend = useMemo(() => {
    const m = new Map<string, number>();
    if (source !== 'mock') return m;
    m.set('mock-root-assets', 12.5);
    m.set('mock-cash-group', 8.2);
    m.set('mock-petty', 3.1);
    m.set('mock-bank-group', 15.0);
    m.set('mock-root-liab', -4.2);
    m.set('mock-ap', 2.4);
    return m;
  }, [source]);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-white">Accounts hierarchy UI (test)</h1>
        <p className="text-sm text-gray-400 max-w-2xl">
          Preview the chart-style rows, icons, Control badge, rollup balances, and 3-dot menu. When satisfied, the same list is used on
          Accounting → Accounts. Open this page at{' '}
          <code className="text-gray-500 text-xs">/test/accounting-accounts-hierarchy</code>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-gray-800 bg-gray-900/50 p-0.5">
          <button
            type="button"
            onClick={() => setSource('mock')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${source === 'mock' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
          >
            Mock data
          </button>
          <button
            type="button"
            onClick={() => setSource('live')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${source === 'live' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
          >
            Live company
          </button>
        </div>
        <div className="flex rounded-lg border border-gray-800 bg-gray-900/50 p-0.5">
          <button
            type="button"
            onClick={() => setAccountsViewMode('operational')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${accountsViewMode === 'operational' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
          >
            Operational
          </button>
          <button
            type="button"
            onClick={() => setAccountsViewMode('professional')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${accountsViewMode === 'professional' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
          >
            Professional
          </button>
        </div>
        {accountsViewMode === 'professional' && (
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showSubAccounts}
              onChange={(e) => setShowSubAccounts(e.target.checked)}
              className="rounded border-gray-600 bg-gray-800"
            />
            Show sub-accounts
          </label>
        )}
      </div>

      {accounts.length === 0 ? (
        <p className="text-gray-500 text-sm">No accounts (switch to mock or ensure company has accounts).</p>
      ) : (
        <AccountsHierarchyList
          rows={hierarchyRows}
          accountsViewMode={accountsViewMode}
          formatCurrency={formatCurrency}
          trendPctForRow={(row) => demoTrend.get(row.account.id) ?? null}
          renderRowMenu={() => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-gray-400 hover:text-white hover:bg-gray-800">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 bg-gray-950/95 border-gray-800 text-gray-200 shadow-xl backdrop-blur-md">
                <DropdownMenuItem className="gap-2 focus:bg-gray-800" onClick={() => toast.message('View Details (test)')}>
                  <Eye className="h-4 w-4" /> View Details
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 focus:bg-gray-800" onClick={() => toast.message('Edit (test)')}>
                  <Pencil className="h-4 w-4" /> Edit Account
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 focus:bg-gray-800" onClick={() => toast.message('Ledger (test)')}>
                  <FileText className="h-4 w-4" /> View Ledger
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 focus:bg-gray-800" onClick={() => toast.message('Statement (test)')}>
                  <BarChart3 className="h-4 w-4" /> Statement
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-800" />
                <DropdownMenuItem className="gap-2 focus:bg-gray-800" onClick={() => toast.message('Transfer (test)')}>
                  <ArrowLeftRight className="h-4 w-4" /> Transfer Balance
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 focus:bg-gray-800" onClick={() => toast.message('Add child (test)')}>
                  <FolderPlus className="h-4 w-4" /> Add Child Account
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 focus:bg-gray-800" onClick={() => toast.message('Duplicate (test)')}>
                  <Copy className="h-4 w-4" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-800" />
                <DropdownMenuItem
                  className="gap-2 text-red-400 focus:text-red-300 focus:bg-red-950/40"
                  onClick={() => toast.error('Delete disabled on test page')}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        />
      )}

      <p className="text-[11px] text-gray-600 flex items-center gap-1">
        <PanelTop className="h-3.5 w-3.5" />
        Menu items here are stubs; Accounting → Accounts wires real actions.
      </p>
    </div>
  );
};

export default AccountsHierarchyTestPage;
