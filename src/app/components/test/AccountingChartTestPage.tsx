import React, { useState, useMemo, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Folder,
  FileText,
  DollarSign,
  CreditCard,
  Wallet,
  TrendingUp,
  TrendingDown,
  Search,
  MoreVertical,
  Lock,
  Building2,
  Globe,
  Save,
  X,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Badge } from '@/app/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { Switch } from '@/app/components/ui/switch';
import { cn } from '@/app/components/ui/utils';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
type NormalBalance = 'debit' | 'credit';
type BranchScope = 'global' | 'specific';

interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  parentId: string | null;
  branchScope: BranchScope;
  branchId?: string;
  isActive: boolean;
  isSystem: boolean; // System accounts are read-only
  description?: string;
  openingBalance?: number;
  currentBalance?: number;
  children?: Account[];
  level: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ACCOUNT_TYPE_CONFIG: Record<AccountType, {
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  prefix: string;
  normalBalance: NormalBalance;
}> = {
  asset: {
    label: 'Asset',
    icon: DollarSign,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    prefix: 'AST',
    normalBalance: 'debit',
  },
  liability: {
    label: 'Liability',
    icon: CreditCard,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    prefix: 'LIA',
    normalBalance: 'credit',
  },
  equity: {
    label: 'Equity',
    icon: Wallet,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    prefix: 'EQT',
    normalBalance: 'credit',
  },
  income: {
    label: 'Income',
    icon: TrendingUp,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    prefix: 'INC',
    normalBalance: 'credit',
  },
  expense: {
    label: 'Expense',
    icon: TrendingDown,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    prefix: 'EXP',
    normalBalance: 'debit',
  },
};

// Sample data - Chart of Accounts
const INITIAL_ACCOUNTS: Account[] = [
  // ASSETS
  {
    id: 'ast-root',
    code: 'AST-000',
    name: 'Assets',
    type: 'asset',
    normalBalance: 'debit',
    parentId: null,
    branchScope: 'global',
    isActive: true,
    isSystem: true,
    level: 0,
  },
  {
    id: 'ast-001',
    code: 'AST-001',
    name: 'Current Assets',
    type: 'asset',
    normalBalance: 'debit',
    parentId: 'ast-root',
    branchScope: 'global',
    isActive: true,
    isSystem: true,
    level: 1,
  },
  {
    id: 'ast-001-001',
    code: 'AST-001-001',
    name: 'Cash',
    type: 'asset',
    normalBalance: 'debit',
    parentId: 'ast-001',
    branchScope: 'global',
    isActive: true,
    isSystem: true,
    currentBalance: 125000,
    level: 2,
  },
  {
    id: 'ast-001-002',
    code: 'AST-001-002',
    name: 'Cash Drawer',
    type: 'asset',
    normalBalance: 'debit',
    parentId: 'ast-001',
    branchScope: 'specific',
    branchId: 'branch-main',
    isActive: true,
    isSystem: false,
    currentBalance: 5000,
    level: 2,
  },
  {
    id: 'ast-001-003',
    code: 'AST-001-003',
    name: 'Bank - HBL',
    type: 'asset',
    normalBalance: 'debit',
    parentId: 'ast-001',
    branchScope: 'global',
    isActive: true,
    isSystem: false,
    currentBalance: 450000,
    level: 2,
  },
  {
    id: 'ast-001-004',
    code: 'AST-001-004',
    name: 'Accounts Receivable',
    type: 'asset',
    normalBalance: 'debit',
    parentId: 'ast-001',
    branchScope: 'global',
    isActive: true,
    isSystem: true,
    currentBalance: 85000,
    level: 2,
  },
  {
    id: 'ast-001-005',
    code: 'AST-001-005',
    name: 'Inventory',
    type: 'asset',
    normalBalance: 'debit',
    parentId: 'ast-001',
    branchScope: 'global',
    isActive: true,
    isSystem: true,
    currentBalance: 320000,
    level: 2,
  },
  {
    id: 'ast-002',
    code: 'AST-002',
    name: 'Fixed Assets',
    type: 'asset',
    normalBalance: 'debit',
    parentId: 'ast-root',
    branchScope: 'global',
    isActive: true,
    isSystem: true,
    level: 1,
  },
  {
    id: 'ast-002-001',
    code: 'AST-002-001',
    name: 'Equipment',
    type: 'asset',
    normalBalance: 'debit',
    parentId: 'ast-002',
    branchScope: 'global',
    isActive: true,
    isSystem: false,
    currentBalance: 150000,
    level: 2,
  },
  {
    id: 'ast-002-002',
    code: 'AST-002-002',
    name: 'Vehicles',
    type: 'asset',
    normalBalance: 'debit',
    parentId: 'ast-002',
    branchScope: 'global',
    isActive: true,
    isSystem: false,
    currentBalance: 280000,
    level: 2,
  },

  // LIABILITIES
  {
    id: 'lia-root',
    code: 'LIA-000',
    name: 'Liabilities',
    type: 'liability',
    normalBalance: 'credit',
    parentId: null,
    branchScope: 'global',
    isActive: true,
    isSystem: true,
    level: 0,
  },
  {
    id: 'lia-001',
    code: 'LIA-001',
    name: 'Current Liabilities',
    type: 'liability',
    normalBalance: 'credit',
    parentId: 'lia-root',
    branchScope: 'global',
    isActive: true,
    isSystem: true,
    level: 1,
  },
  {
    id: 'lia-001-001',
    code: 'LIA-001-001',
    name: 'Accounts Payable',
    type: 'liability',
    normalBalance: 'credit',
    parentId: 'lia-001',
    branchScope: 'global',
    isActive: true,
    isSystem: true,
    currentBalance: 65000,
    level: 2,
  },
  {
    id: 'lia-001-002',
    code: 'LIA-001-002',
    name: 'Sales Tax Payable',
    type: 'liability',
    normalBalance: 'credit',
    parentId: 'lia-001',
    branchScope: 'global',
    isActive: true,
    isSystem: true,
    currentBalance: 12000,
    level: 2,
  },
  {
    id: 'lia-002',
    code: 'LIA-002',
    name: 'Long-term Liabilities',
    type: 'liability',
    normalBalance: 'credit',
    parentId: 'lia-root',
    branchScope: 'global',
    isActive: true,
    isSystem: true,
    level: 1,
  },
  {
    id: 'lia-002-001',
    code: 'LIA-002-001',
    name: 'Bank Loan',
    type: 'liability',
    normalBalance: 'credit',
    parentId: 'lia-002',
    branchScope: 'global',
    isActive: true,
    isSystem: false,
    currentBalance: 200000,
    level: 2,
  },

  // EQUITY
  {
    id: 'eqt-root',
    code: 'EQT-000',
    name: 'Equity',
    type: 'equity',
    normalBalance: 'credit',
    parentId: null,
    branchScope: 'global',
    isActive: true,
    isSystem: true,
    level: 0,
  },
  {
    id: 'eqt-001',
    code: 'EQT-001',
    name: 'Owner\'s Capital',
    type: 'equity',
    normalBalance: 'credit',
    parentId: 'eqt-root',
    branchScope: 'global',
    isActive: true,
    isSystem: true,
    currentBalance: 500000,
    level: 1,
  },
  {
    id: 'eqt-002',
    code: 'EQT-002',
    name: 'Retained Earnings',
    type: 'equity',
    normalBalance: 'credit',
    parentId: 'eqt-root',
    branchScope: 'global',
    isActive: true,
    isSystem: true,
    currentBalance: 150000,
    level: 1,
  },

  // INCOME
  {
    id: 'inc-root',
    code: 'INC-000',
    name: 'Income',
    type: 'income',
    normalBalance: 'credit',
    parentId: null,
    branchScope: 'global',
    isActive: true,
    isSystem: true,
    level: 0,
  },
  {
    id: 'inc-001',
    code: 'INC-001',
    name: 'Sales Revenue',
    type: 'income',
    normalBalance: 'credit',
    parentId: 'inc-root',
    branchScope: 'global',
    isActive: true,
    isSystem: true,
    currentBalance: 850000,
    level: 1,
  },
  {
    id: 'inc-002',
    code: 'INC-002',
    name: 'Service Revenue',
    type: 'income',
    normalBalance: 'credit',
    parentId: 'inc-root',
    branchScope: 'global',
    isActive: true,
    isSystem: false,
    currentBalance: 120000,
    level: 1,
  },
  {
    id: 'inc-003',
    code: 'INC-003',
    name: 'Other Income',
    type: 'income',
    normalBalance: 'credit',
    parentId: 'inc-root',
    branchScope: 'global',
    isActive: true,
    isSystem: false,
    currentBalance: 15000,
    level: 1,
  },

  // EXPENSES
  {
    id: 'exp-root',
    code: 'EXP-000',
    name: 'Expenses',
    type: 'expense',
    normalBalance: 'debit',
    parentId: null,
    branchScope: 'global',
    isActive: true,
    isSystem: true,
    level: 0,
  },
  {
    id: 'exp-001',
    code: 'EXP-001',
    name: 'Cost of Goods Sold',
    type: 'expense',
    normalBalance: 'debit',
    parentId: 'exp-root',
    branchScope: 'global',
    isActive: true,
    isSystem: true,
    currentBalance: 420000,
    level: 1,
  },
  {
    id: 'exp-002',
    code: 'EXP-002',
    name: 'Operating Expenses',
    type: 'expense',
    normalBalance: 'debit',
    parentId: 'exp-root',
    branchScope: 'global',
    isActive: true,
    isSystem: true,
    level: 1,
  },
  {
    id: 'exp-002-001',
    code: 'EXP-002-001',
    name: 'Salaries & Wages',
    type: 'expense',
    normalBalance: 'debit',
    parentId: 'exp-002',
    branchScope: 'global',
    isActive: true,
    isSystem: false,
    currentBalance: 180000,
    level: 2,
  },
  {
    id: 'exp-002-002',
    code: 'EXP-002-002',
    name: 'Rent Expense',
    type: 'expense',
    normalBalance: 'debit',
    parentId: 'exp-002',
    branchScope: 'global',
    isActive: true,
    isSystem: false,
    currentBalance: 60000,
    level: 2,
  },
  {
    id: 'exp-002-003',
    code: 'EXP-002-003',
    name: 'Utilities',
    type: 'expense',
    normalBalance: 'debit',
    parentId: 'exp-002',
    branchScope: 'global',
    isActive: true,
    isSystem: false,
    currentBalance: 25000,
    level: 2,
  },
  {
    id: 'exp-002-004',
    code: 'EXP-002-004',
    name: 'Marketing',
    type: 'expense',
    normalBalance: 'debit',
    parentId: 'exp-002',
    branchScope: 'global',
    isActive: true,
    isSystem: false,
    currentBalance: 35000,
    level: 2,
  },
  {
    id: 'exp-003',
    code: 'EXP-003',
    name: 'Administrative Expenses',
    type: 'expense',
    normalBalance: 'debit',
    parentId: 'exp-root',
    branchScope: 'global',
    isActive: true,
    isSystem: false,
    level: 1,
  },
  {
    id: 'exp-003-001',
    code: 'EXP-003-001',
    name: 'Office Supplies',
    type: 'expense',
    normalBalance: 'debit',
    parentId: 'exp-003',
    branchScope: 'global',
    isActive: true,
    isSystem: false,
    currentBalance: 8000,
    level: 2,
  },
  {
    id: 'exp-003-002',
    code: 'EXP-003-002',
    name: 'Professional Fees',
    type: 'expense',
    normalBalance: 'debit',
    parentId: 'exp-003',
    branchScope: 'global',
    isActive: true,
    isSystem: false,
    currentBalance: 15000,
    level: 2,
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const generateAccountCode = (type: AccountType, accounts: Account[], parentId: string | null): string => {
  const config = ACCOUNT_TYPE_CONFIG[type];
  const prefix = config.prefix;
  
  // Find all accounts of this type
  const typeAccounts = accounts.filter(a => a.type === type);
  
  if (parentId) {
    // Sub-account: append sequence to parent code
    const parent = accounts.find(a => a.id === parentId);
    if (parent) {
      const siblings = typeAccounts.filter(a => a.parentId === parentId);
      const nextNum = siblings.length + 1;
      return `${parent.code}-${String(nextNum).padStart(3, '0')}`;
    }
  }
  
  // Root level account
  const rootAccounts = typeAccounts.filter(a => a.parentId === null || a.parentId === `${type}-root`);
  const nextNum = rootAccounts.length + 1;
  return `${prefix}-${String(nextNum).padStart(3, '0')}`;
};

const buildAccountTree = (accounts: Account[]): Account[] => {
  const accountMap = new Map<string, Account>();
  const rootAccounts: Account[] = [];

  // First pass: create map and initialize children arrays
  accounts.forEach(account => {
    accountMap.set(account.id, { ...account, children: [] });
  });

  // Second pass: build tree structure
  accounts.forEach(account => {
    const currentAccount = accountMap.get(account.id)!;
    if (account.parentId && accountMap.has(account.parentId)) {
      const parent = accountMap.get(account.parentId)!;
      parent.children = parent.children || [];
      parent.children.push(currentAccount);
    } else if (!account.parentId) {
      rootAccounts.push(currentAccount);
    }
  });

  // Sort by type order then by code
  const typeOrder: AccountType[] = ['asset', 'liability', 'equity', 'income', 'expense'];
  return rootAccounts.sort((a, b) => {
    const typeCompare = typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
    if (typeCompare !== 0) return typeCompare;
    return a.code.localeCompare(b.code);
  });
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// ============================================================================
// COMPONENTS
// ============================================================================

interface AccountTreeItemProps {
  account: Account;
  level: number;
  expanded: Set<string>;
  toggleExpand: (id: string) => void;
  selectedId: string | null;
  onSelect: (account: Account) => void;
}

const AccountTreeItem: React.FC<AccountTreeItemProps> = ({
  account,
  level,
  expanded,
  toggleExpand,
  selectedId,
  onSelect,
}) => {
  const hasChildren = account.children && account.children.length > 0;
  const isExpanded = expanded.has(account.id);
  const isSelected = selectedId === account.id;
  const config = ACCOUNT_TYPE_CONFIG[account.type];
  const Icon = config.icon;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 cursor-pointer transition-all rounded-lg mx-1 my-0.5',
          isSelected
            ? 'bg-indigo-600/30 border border-indigo-500/50'
            : 'hover:bg-gray-800/50 border border-transparent',
          !account.isActive && 'opacity-50'
        )}
        style={{ paddingLeft: `${level * 20 + 12}px` }}
        onClick={() => onSelect(account)}
      >
        {/* Expand/Collapse Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) toggleExpand(account.id);
          }}
          className={cn(
            'w-5 h-5 flex items-center justify-center rounded',
            hasChildren ? 'hover:bg-gray-700' : 'invisible'
          )}
        >
          {hasChildren && (
            isExpanded ? (
              <ChevronDown size={14} className="text-gray-400" />
            ) : (
              <ChevronRight size={14} className="text-gray-400" />
            )
          )}
        </button>

        {/* Icon */}
        <div className={cn('w-6 h-6 rounded flex items-center justify-center', config.bgColor)}>
          {hasChildren ? (
            <Folder size={14} className={config.color} />
          ) : (
            <Icon size={14} className={config.color} />
          )}
        </div>

        {/* Account Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-sm font-medium truncate',
              isSelected ? 'text-white' : 'text-gray-200'
            )}>
              {account.name}
            </span>
            {account.isSystem && (
              <Lock size={10} className="text-gray-500 shrink-0" />
            )}
          </div>
          <span className="text-xs text-gray-500 font-mono">{account.code}</span>
        </div>

        {/* Balance (for leaf accounts) */}
        {!hasChildren && account.currentBalance !== undefined && (
          <span className={cn(
            'text-xs font-mono',
            account.currentBalance >= 0 ? 'text-emerald-400' : 'text-red-400'
          )}>
            {formatCurrency(account.currentBalance)}
          </span>
        )}

        {/* Status */}
        {!account.isActive && (
          <Badge variant="outline" className="text-xs bg-gray-800 text-gray-400 border-gray-700">
            Inactive
          </Badge>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {account.children!.map(child => (
            <AccountTreeItem
              key={child.id}
              account={child}
              level={level + 1}
              expanded={expanded}
              toggleExpand={toggleExpand}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const AccountingChartTestPage: React.FC = () => {
  // State
  const [accounts, setAccounts] = useState<Account[]>(INITIAL_ACCOUNTS);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['ast-root', 'lia-root', 'eqt-root', 'inc-root', 'exp-root']));
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createAsChild, setCreateAsChild] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<Account>>({
    name: '',
    type: 'expense',
    normalBalance: 'debit',
    branchScope: 'global',
    isActive: true,
    description: '',
    openingBalance: 0,
  });

  // Build tree
  const accountTree = useMemo(() => buildAccountTree(accounts), [accounts]);

  // Filter accounts
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return accountTree;
    
    const query = searchQuery.toLowerCase();
    const matchingIds = new Set<string>();
    
    // Find matching accounts and their ancestors
    const findMatches = (acc: Account) => {
      if (acc.name.toLowerCase().includes(query) || acc.code.toLowerCase().includes(query)) {
        // Add this account and all ancestors
        let current: Account | undefined = acc;
        while (current) {
          matchingIds.add(current.id);
          current = accounts.find(a => a.id === current?.parentId);
        }
      }
      acc.children?.forEach(findMatches);
    };
    
    accountTree.forEach(findMatches);
    
    // Filter tree to only include matching accounts
    const filterTree = (accs: Account[]): Account[] => {
      return accs
        .filter(a => matchingIds.has(a.id))
        .map(a => ({
          ...a,
          children: a.children ? filterTree(a.children) : [],
        }));
    };
    
    return filterTree(accountTree);
  }, [accountTree, searchQuery, accounts]);

  // Handlers
  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allIds = accounts.map(a => a.id);
    setExpanded(new Set(allIds));
  }, [accounts]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set(['ast-root', 'lia-root', 'eqt-root', 'inc-root', 'exp-root']));
  }, []);

  const handleSelect = useCallback((account: Account) => {
    setSelectedAccount(account);
    setIsEditing(false);
    setIsCreating(false);
  }, []);

  const startCreate = useCallback((asChild: boolean) => {
    const parentId = asChild && selectedAccount ? selectedAccount.id : null;
    const parentType = asChild && selectedAccount ? selectedAccount.type : 'expense';
    
    setFormData({
      name: '',
      type: parentType,
      normalBalance: ACCOUNT_TYPE_CONFIG[parentType].normalBalance,
      branchScope: 'global',
      isActive: true,
      description: '',
      openingBalance: 0,
    });
    setCreateAsChild(asChild);
    setIsCreating(true);
    setIsEditing(false);
  }, [selectedAccount]);

  const startEdit = useCallback(() => {
    if (!selectedAccount || selectedAccount.isSystem) return;
    setFormData({ ...selectedAccount });
    setIsEditing(true);
    setIsCreating(false);
  }, [selectedAccount]);

  const handleSave = useCallback(() => {
    if (!formData.name?.trim()) {
      toast.error('Account name is required');
      return;
    }

    if (isCreating) {
      const parentId = createAsChild && selectedAccount ? selectedAccount.id : 
        accounts.find(a => a.type === formData.type && a.parentId === null)?.id || null;
      
      const newCode = generateAccountCode(formData.type as AccountType, accounts, parentId);
      const parentAccount = parentId ? accounts.find(a => a.id === parentId) : null;
      
      const newAccount: Account = {
        id: `acc-${Date.now()}`,
        code: newCode,
        name: formData.name!.trim(),
        type: formData.type as AccountType,
        normalBalance: formData.normalBalance as NormalBalance,
        parentId: parentId,
        branchScope: formData.branchScope as BranchScope,
        branchId: formData.branchId,
        isActive: formData.isActive ?? true,
        isSystem: false,
        description: formData.description,
        openingBalance: formData.openingBalance,
        currentBalance: formData.openingBalance || 0,
        level: parentAccount ? parentAccount.level + 1 : 0,
      };

      setAccounts(prev => [...prev, newAccount]);
      setSelectedAccount(newAccount);
      
      // Expand parent
      if (parentId) {
        setExpanded(prev => new Set([...prev, parentId]));
      }
      
      toast.success(`Account "${newAccount.name}" created successfully`);
    } else if (isEditing && selectedAccount) {
      setAccounts(prev => prev.map(a => 
        a.id === selectedAccount.id 
          ? { ...a, ...formData, name: formData.name!.trim() }
          : a
      ));
      setSelectedAccount(prev => prev ? { ...prev, ...formData, name: formData.name!.trim() } : null);
      toast.success(`Account "${formData.name}" updated successfully`);
    }

    setIsCreating(false);
    setIsEditing(false);
  }, [formData, isCreating, isEditing, createAsChild, selectedAccount, accounts]);

  const handleCancel = useCallback(() => {
    setIsCreating(false);
    setIsEditing(false);
    setFormData({});
  }, []);

  const toggleAccountStatus = useCallback((account: Account) => {
    if (account.isSystem) {
      toast.error('System accounts cannot be disabled');
      return;
    }
    
    setAccounts(prev => prev.map(a => 
      a.id === account.id ? { ...a, isActive: !a.isActive } : a
    ));
    setSelectedAccount(prev => prev?.id === account.id ? { ...prev, isActive: !prev.isActive } : prev);
    toast.success(`Account ${account.isActive ? 'disabled' : 'enabled'}`);
  }, []);

  // Stats
  const stats = useMemo(() => {
    const active = accounts.filter(a => a.isActive).length;
    const inactive = accounts.filter(a => !a.isActive).length;
    const byType = Object.keys(ACCOUNT_TYPE_CONFIG).map(type => ({
      type: type as AccountType,
      count: accounts.filter(a => a.type === type).length,
    }));
    return { active, inactive, byType, total: accounts.length };
  }, [accounts]);

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <FileText size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Chart of Accounts</h1>
                <p className="text-sm text-gray-400">Test Page - Accounting Foundation</p>
              </div>
            </div>
          </div>
          
          {/* Stats */}
          <div className="flex items-center gap-4">
            {stats.byType.map(({ type, count }) => {
              const config = ACCOUNT_TYPE_CONFIG[type];
              return (
                <div key={type} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/50">
                  <config.icon size={14} className={config.color} />
                  <span className="text-xs text-gray-400">{config.label}</span>
                  <span className="text-sm font-semibold text-white">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Account Tree */}
        <div className="w-[400px] border-r border-gray-800 flex flex-col bg-gray-900/30">
          {/* Tree Toolbar */}
          <div className="p-3 border-b border-gray-800 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search accounts..."
                className="pl-9 bg-gray-900 border-gray-700 text-white text-sm"
              />
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => startCreate(false)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Plus size={14} className="mr-1" />
                New Account
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={expandAll}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Expand All
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={collapseAll}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Collapse
              </Button>
            </div>
          </div>

          {/* Tree List */}
          <div className="flex-1 overflow-auto py-2">
            {filteredTree.map(account => (
              <AccountTreeItem
                key={account.id}
                account={account}
                level={0}
                expanded={expanded}
                toggleExpand={toggleExpand}
                selectedId={selectedAccount?.id || null}
                onSelect={handleSelect}
              />
            ))}
            
            {filteredTree.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <Search size={32} className="mx-auto mb-2 opacity-50" />
                <p>No accounts found</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Account Details */}
        <div className="flex-1 flex flex-col bg-gray-950 overflow-auto">
          {selectedAccount && !isCreating ? (
            <>
              {/* Account Header */}
              <div className="p-6 border-b border-gray-800">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      'w-14 h-14 rounded-xl flex items-center justify-center',
                      ACCOUNT_TYPE_CONFIG[selectedAccount.type].bgColor
                    )}>
                      {React.createElement(ACCOUNT_TYPE_CONFIG[selectedAccount.type].icon, {
                        size: 28,
                        className: ACCOUNT_TYPE_CONFIG[selectedAccount.type].color,
                      })}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-2xl font-bold text-white">{selectedAccount.name}</h2>
                        {selectedAccount.isSystem && (
                          <Badge className="bg-gray-700 text-gray-300">
                            <Lock size={10} className="mr-1" />
                            System
                          </Badge>
                        )}
                        {!selectedAccount.isActive && (
                          <Badge variant="outline" className="border-red-500/50 text-red-400">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={cn('font-mono', ACCOUNT_TYPE_CONFIG[selectedAccount.type].bgColor, ACCOUNT_TYPE_CONFIG[selectedAccount.type].color)}>
                          {selectedAccount.code}
                        </Badge>
                        <Badge variant="outline" className="border-gray-700 text-gray-400">
                          {ACCOUNT_TYPE_CONFIG[selectedAccount.type].label}
                        </Badge>
                        <Badge variant="outline" className={cn(
                          'border-gray-700',
                          selectedAccount.normalBalance === 'debit' ? 'text-emerald-400' : 'text-blue-400'
                        )}>
                          {selectedAccount.normalBalance === 'debit' ? 'Debit Balance' : 'Credit Balance'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {!selectedAccount.isSystem && (
                      <>
                        {!isEditing && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={startEdit}
                            className="border-gray-700 text-gray-300 hover:bg-gray-800"
                          >
                            <Edit2 size={14} className="mr-1" />
                            Edit
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleAccountStatus(selectedAccount)}
                          className={cn(
                            'border-gray-700',
                            selectedAccount.isActive ? 'text-red-400 hover:bg-red-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'
                          )}
                        >
                          {selectedAccount.isActive ? (
                            <>
                              <ToggleLeft size={14} className="mr-1" />
                              Disable
                            </>
                          ) : (
                            <>
                              <ToggleRight size={14} className="mr-1" />
                              Enable
                            </>
                          )}
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      onClick={() => startCreate(true)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <Plus size={14} className="mr-1" />
                      Add Sub-Account
                    </Button>
                  </div>
                </div>
              </div>

              {/* Account Details or Edit Form */}
              {isEditing ? (
                <AccountForm
                  formData={formData}
                  setFormData={setFormData}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  isSystem={selectedAccount.isSystem}
                  parentAccount={accounts.find(a => a.id === selectedAccount.parentId)}
                />
              ) : (
                <AccountDetails account={selectedAccount} accounts={accounts} />
              )}
            </>
          ) : isCreating ? (
            <>
              {/* Create Header */}
              <div className="p-6 border-b border-gray-800">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                    <Plus size={28} className="text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {createAsChild ? `New Sub-Account under "${selectedAccount?.name}"` : 'New Account'}
                    </h2>
                    <p className="text-gray-400">Fill in the details below to create a new account</p>
                  </div>
                </div>
              </div>

              <AccountForm
                formData={formData}
                setFormData={setFormData}
                onSave={handleSave}
                onCancel={handleCancel}
                isSystem={false}
                parentAccount={createAsChild ? selectedAccount : undefined}
                isNew
              />
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
                  <FileText size={40} className="text-gray-600" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Select an Account</h3>
                <p className="text-gray-400 mb-6">Choose an account from the tree to view its details</p>
                <Button
                  onClick={() => startCreate(false)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Plus size={16} className="mr-2" />
                  Create New Account
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface AccountFormProps {
  formData: Partial<Account>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Account>>>;
  onSave: () => void;
  onCancel: () => void;
  isSystem: boolean;
  parentAccount?: Account | null;
  isNew?: boolean;
}

const AccountForm: React.FC<AccountFormProps> = ({
  formData,
  setFormData,
  onSave,
  onCancel,
  isSystem,
  parentAccount,
  isNew,
}) => {
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-2xl space-y-6">
        {isSystem && (
          <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <AlertCircle size={20} className="text-amber-400" />
            <p className="text-amber-300 text-sm">
              This is a system account. Only limited fields can be modified.
            </p>
          </div>
        )}

        {parentAccount && (
          <div className="flex items-center gap-3 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
            <Folder size={20} className="text-indigo-400" />
            <div>
              <p className="text-indigo-300 text-sm">Creating sub-account under:</p>
              <p className="text-white font-medium">{parentAccount.name} ({parentAccount.code})</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          {/* Account Name */}
          <div className="col-span-2">
            <Label className="text-gray-300 mb-2 block">Account Name *</Label>
            <Input
              value={formData.name || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Office Supplies"
              className="bg-gray-900 border-gray-700 text-white"
              disabled={isSystem}
            />
          </div>

          {/* Account Type */}
          <div>
            <Label className="text-gray-300 mb-2 block">Account Type *</Label>
            <Select
              value={formData.type}
              onValueChange={(value: AccountType) => {
                setFormData(prev => ({
                  ...prev,
                  type: value,
                  normalBalance: ACCOUNT_TYPE_CONFIG[value].normalBalance,
                }));
              }}
              disabled={isSystem || !!parentAccount}
            >
              <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700">
                {Object.entries(ACCOUNT_TYPE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key} className="text-white hover:bg-gray-800">
                    <div className="flex items-center gap-2">
                      <config.icon size={14} className={config.color} />
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Normal Balance */}
          <div>
            <Label className="text-gray-300 mb-2 block">Normal Balance</Label>
            <Select
              value={formData.normalBalance}
              onValueChange={(value: NormalBalance) => setFormData(prev => ({ ...prev, normalBalance: value }))}
              disabled={isSystem}
            >
              <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                <SelectValue placeholder="Select balance type" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700">
                <SelectItem value="debit" className="text-white hover:bg-gray-800">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-emerald-400" />
                    Debit
                  </div>
                </SelectItem>
                <SelectItem value="credit" className="text-white hover:bg-gray-800">
                  <div className="flex items-center gap-2">
                    <TrendingDown size={14} className="text-blue-400" />
                    Credit
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Branch Scope */}
          <div>
            <Label className="text-gray-300 mb-2 block">Branch Scope</Label>
            <Select
              value={formData.branchScope}
              onValueChange={(value: BranchScope) => setFormData(prev => ({ ...prev, branchScope: value }))}
              disabled={isSystem}
            >
              <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                <SelectValue placeholder="Select scope" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700">
                <SelectItem value="global" className="text-white hover:bg-gray-800">
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="text-blue-400" />
                    Global (All Branches)
                  </div>
                </SelectItem>
                <SelectItem value="specific" className="text-white hover:bg-gray-800">
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-purple-400" />
                    Specific Branch
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Opening Balance */}
          <div>
            <Label className="text-gray-300 mb-2 block">Opening Balance</Label>
            <Input
              type="number"
              value={formData.openingBalance || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, openingBalance: parseFloat(e.target.value) || 0 }))}
              placeholder="0"
              className="bg-gray-900 border-gray-700 text-white"
            />
          </div>

          {/* Description */}
          <div className="col-span-2">
            <Label className="text-gray-300 mb-2 block">Description</Label>
            <Input
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description..."
              className="bg-gray-900 border-gray-700 text-white"
            />
          </div>

          {/* Active Status */}
          <div className="col-span-2">
            <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg border border-gray-800">
              <div>
                <Label className="text-white font-medium">Active Status</Label>
                <p className="text-sm text-gray-400">Inactive accounts won't appear in transaction forms</p>
              </div>
              <Switch
                checked={formData.isActive ?? true}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                disabled={isSystem}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-800">
          <Button
            onClick={onSave}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Save size={16} className="mr-2" />
            {isNew ? 'Create Account' : 'Save Changes'}
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <X size={16} className="mr-2" />
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

interface AccountDetailsProps {
  account: Account;
  accounts: Account[];
}

const AccountDetails: React.FC<AccountDetailsProps> = ({ account, accounts }) => {
  const parent = account.parentId ? accounts.find(a => a.id === account.parentId) : null;
  const children = accounts.filter(a => a.parentId === account.id);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="grid grid-cols-3 gap-6">
        {/* Balance Card */}
        {account.currentBalance !== undefined && (
          <div className="col-span-3 p-6 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-xl border border-indigo-500/20">
            <p className="text-sm text-gray-400 mb-1">Current Balance</p>
            <p className={cn(
              'text-3xl font-bold',
              account.currentBalance >= 0 ? 'text-emerald-400' : 'text-red-400'
            )}>
              {formatCurrency(account.currentBalance)}
            </p>
          </div>
        )}

        {/* Info Cards */}
        <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Account Code</p>
          <p className="text-lg font-mono text-white">{account.code}</p>
        </div>

        <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Account Type</p>
          <div className="flex items-center gap-2">
            {React.createElement(ACCOUNT_TYPE_CONFIG[account.type].icon, {
              size: 16,
              className: ACCOUNT_TYPE_CONFIG[account.type].color,
            })}
            <p className="text-lg text-white">{ACCOUNT_TYPE_CONFIG[account.type].label}</p>
          </div>
        </div>

        <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Normal Balance</p>
          <p className={cn(
            'text-lg font-medium',
            account.normalBalance === 'debit' ? 'text-emerald-400' : 'text-blue-400'
          )}>
            {account.normalBalance === 'debit' ? 'Debit' : 'Credit'}
          </p>
        </div>

        <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Branch Scope</p>
          <div className="flex items-center gap-2">
            {account.branchScope === 'global' ? (
              <Globe size={16} className="text-blue-400" />
            ) : (
              <Building2 size={16} className="text-purple-400" />
            )}
            <p className="text-lg text-white">
              {account.branchScope === 'global' ? 'All Branches' : 'Specific Branch'}
            </p>
          </div>
        </div>

        <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Status</p>
          <div className="flex items-center gap-2">
            {account.isActive ? (
              <>
                <CheckCircle2 size={16} className="text-emerald-400" />
                <p className="text-lg text-emerald-400">Active</p>
              </>
            ) : (
              <>
                <AlertCircle size={16} className="text-red-400" />
                <p className="text-lg text-red-400">Inactive</p>
              </>
            )}
          </div>
        </div>

        <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Account Level</p>
          <p className="text-lg text-white">Level {account.level}</p>
        </div>

        {/* Parent Account */}
        {parent && (
          <div className="col-span-3 p-4 bg-gray-900 rounded-lg border border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Parent Account</p>
            <div className="flex items-center gap-3">
              <div className={cn('w-8 h-8 rounded flex items-center justify-center', ACCOUNT_TYPE_CONFIG[parent.type].bgColor)}>
                <Folder size={16} className={ACCOUNT_TYPE_CONFIG[parent.type].color} />
              </div>
              <div>
                <p className="text-white font-medium">{parent.name}</p>
                <p className="text-xs text-gray-500 font-mono">{parent.code}</p>
              </div>
            </div>
          </div>
        )}

        {/* Sub-accounts */}
        {children.length > 0 && (
          <div className="col-span-3 p-4 bg-gray-900 rounded-lg border border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">
              Sub-Accounts ({children.length})
            </p>
            <div className="space-y-2">
              {children.map(child => (
                <div key={child.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-8 h-8 rounded flex items-center justify-center', ACCOUNT_TYPE_CONFIG[child.type].bgColor)}>
                      <FileText size={14} className={ACCOUNT_TYPE_CONFIG[child.type].color} />
                    </div>
                    <div>
                      <p className={cn('text-sm font-medium', child.isActive ? 'text-white' : 'text-gray-500')}>
                        {child.name}
                      </p>
                      <p className="text-xs text-gray-500 font-mono">{child.code}</p>
                    </div>
                  </div>
                  {child.currentBalance !== undefined && (
                    <span className={cn(
                      'text-sm font-mono',
                      child.currentBalance >= 0 ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      {formatCurrency(child.currentBalance)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {account.description && (
          <div className="col-span-3 p-4 bg-gray-900 rounded-lg border border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Description</p>
            <p className="text-gray-300">{account.description}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountingChartTestPage;
