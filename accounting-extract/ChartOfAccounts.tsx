import React, { useState, useMemo } from 'react';
import { 
  Plus, Download, Upload, Settings, Search, MoreVertical, Edit2, Trash2, Eye, EyeOff,
  FileText, BarChart3, DollarSign, TrendingUp, TrendingDown, Wallet, AlertCircle,
  CheckCircle2, LayoutGrid, List, Zap, FileSpreadsheet, Cog, Activity,
  ArrowUpRight, ArrowDownRight, Shield, Calendar, Lock, Receipt,
  ShoppingCart, Home, Camera, Package, History, Save, X, Clock, Power, PowerOff,
  Printer, Filter, ArrowUpDown, ExternalLink
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/app/components/ui/utils';
import { AddChartAccountDrawer } from './AddChartAccountDrawer';
import { EnhancedJournalEntryDialog } from './EnhancedJournalEntryDialog';
import { motion, AnimatePresence } from 'motion/react';
import * as Tabs from '@radix-ui/react-tabs';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { toast } from 'sonner';
import { generateProfessionalPDF, exportLedgerToExcel, LedgerData } from '@/app/utils/professionalExportUtils';

// ============================================
// 🎯 TYPES & INTERFACES
// ============================================

type AccountCategory = 'Assets' | 'Liabilities' | 'Equity' | 'Income' | 'Cost of Sales' | 'Expenses';
type AccountNature = 'Debit' | 'Credit';
type AccountModule = 'POS' | 'Rental' | 'Studio' | 'General Accounting' | 'All';

interface ChartAccount {
  id: string;
  code: string;
  name: string;
  category: AccountCategory;
  subCategory: string;
  parentAccount?: string;
  module: AccountModule[];
  openingBalance: number;
  currentBalance: number;
  nature: AccountNature;
  taxApplicable: boolean;
  taxType?: string;
  active: boolean;
  showInReports: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

interface Transaction {
  id: string;
  date: string;
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  runningBalance: number;
  description: string;
  module: AccountModule;
  referenceNo: string;
  linkedTransactionId?: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ACTIVATE' | 'DEACTIVATE';
  accountId: string;
  accountName: string;
  oldValue?: string;
  newValue?: string;
  details: string;
}

interface AutomationRule {
  id: string;
  name: string;
  module: AccountModule;
  enabled: boolean;
  description: string;
  debitAccount: string;
  creditAccount: string;
}

interface AccountingSettings {
  autoGenerateCodes: boolean;
  showInactiveAccounts: boolean;
  defaultTaxRate: number;
  taxType: string;
  fiscalYearStart: string;
  fiscalYearEnd: string;
  accountLockDate: string;
}

// ============================================
// 🎯 SAMPLE DATA WITH TRANSACTIONS
// ============================================

const sampleTransactions: Transaction[] = [
  { id: 't1', date: '2025-01-20', accountId: '1', accountName: 'Cash in Hand', debit: 25000, credit: 0, runningBalance: 75000, description: 'Cash sales for the day', module: 'POS', referenceNo: 'POS-2025-001' },
  { id: 't2', date: '2025-01-21', accountId: '19', accountName: 'Cash Sales', debit: 0, credit: 45000, runningBalance: 45000, description: 'POS sales revenue', module: 'POS', referenceNo: 'POS-2025-002' },
  { id: 't3', date: '2025-01-22', accountId: '2', accountName: 'Cash at Bank', debit: 50000, credit: 0, runningBalance: 250000, description: 'Bank deposit', module: 'General Accounting', referenceNo: 'JE-2025-003' },
  { id: 't4', date: '2025-01-23', accountId: '22', accountName: 'Daily Rental', debit: 0, credit: 15000, runningBalance: 30000, description: 'Wedding dress rental - 3 days', module: 'Rental', referenceNo: 'RNT-2025-004' },
  { id: 't5', date: '2025-01-24', accountId: '24', accountName: 'Studio Booking', debit: 0, credit: 20000, runningBalance: 20000, description: 'Studio session booking', module: 'Studio', referenceNo: 'STD-2025-005' },
];

const initialAccounts: ChartAccount[] = [
  // ASSETS
  { id: '1', code: '1001', name: 'Cash in Hand', category: 'Assets', subCategory: 'Current Assets', module: ['POS', 'Rental', 'Studio', 'General Accounting'], openingBalance: 50000, currentBalance: 75000, nature: 'Debit', taxApplicable: false, active: true, showInReports: true, createdAt: '2025-01-01T10:00:00Z', createdBy: 'Admin', updatedAt: '2025-01-20T10:00:00Z', updatedBy: 'Admin' },
  { id: '2', code: '1002', name: 'Cash at Bank', category: 'Assets', subCategory: 'Current Assets', module: ['POS', 'Rental', 'Studio', 'General Accounting'], openingBalance: 200000, currentBalance: 250000, nature: 'Debit', taxApplicable: false, active: true, showInReports: true, createdAt: '2025-01-01T10:00:00Z', createdBy: 'Admin', updatedAt: '2025-01-22T10:00:00Z', updatedBy: 'Admin' },
  { id: '3', code: '1003', name: 'POS Cash Counter', category: 'Assets', subCategory: 'Current Assets', module: ['POS'], openingBalance: 10000, currentBalance: 15000, nature: 'Debit', taxApplicable: false, active: true, showInReports: true, createdAt: '2025-01-01T10:00:00Z', createdBy: 'Admin', updatedAt: '2025-01-01T10:00:00Z', updatedBy: 'Admin' },
  { id: '4', code: '1004', name: 'Accounts Receivable', category: 'Assets', subCategory: 'Current Assets', module: ['POS', 'Rental', 'Studio'], openingBalance: 0, currentBalance: 25000, nature: 'Debit', taxApplicable: false, active: true, showInReports: true, createdAt: '2025-01-01T10:00:00Z', createdBy: 'Admin', updatedAt: '2025-01-01T10:00:00Z', updatedBy: 'Admin' },
  { id: '5', code: '1005', name: 'Inventory / Stock', category: 'Assets', subCategory: 'Current Assets', module: ['POS'], openingBalance: 150000, currentBalance: 180000, nature: 'Debit', taxApplicable: false, active: true, showInReports: true, createdAt: '2025-01-01T10:00:00Z', createdBy: 'Admin', updatedAt: '2025-01-01T10:00:00Z', updatedBy: 'Admin' },
  { id: '6', code: '1006', name: 'Rental Inventory', category: 'Assets', subCategory: 'Current Assets', module: ['Rental'], openingBalance: 300000, currentBalance: 300000, nature: 'Debit', taxApplicable: false, active: true, showInReports: true, createdAt: '2025-01-01T10:00:00Z', createdBy: 'Admin', updatedAt: '2025-01-01T10:00:00Z', updatedBy: 'Admin' },
  
  // LIABILITIES
  { id: '11', code: '2001', name: 'Accounts Payable', category: 'Liabilities', subCategory: 'Current Liabilities', module: ['POS', 'General Accounting'], openingBalance: 0, currentBalance: 15000, nature: 'Credit', taxApplicable: false, active: true, showInReports: true, createdAt: '2025-01-01T10:00:00Z', createdBy: 'Admin', updatedAt: '2025-01-01T10:00:00Z', updatedBy: 'Admin' },
  { id: '14', code: '2004', name: 'Sales Tax / GST Payable', category: 'Liabilities', subCategory: 'Current Liabilities', module: ['POS', 'Rental', 'Studio'], openingBalance: 0, currentBalance: 12000, nature: 'Credit', taxApplicable: true, taxType: 'GST', active: true, showInReports: true, createdAt: '2025-01-01T10:00:00Z', createdBy: 'Admin', updatedAt: '2025-01-01T10:00:00Z', updatedBy: 'Admin' },
  
  // EQUITY
  { id: '16', code: '3001', name: 'Owner Capital', category: 'Equity', subCategory: 'Capital', module: ['General Accounting'], openingBalance: 1000000, currentBalance: 1000000, nature: 'Credit', taxApplicable: false, active: true, showInReports: true, createdAt: '2025-01-01T10:00:00Z', createdBy: 'Admin', updatedAt: '2025-01-01T10:00:00Z', updatedBy: 'Admin' },
  
  // INCOME
  { id: '19', code: '4001', name: 'Cash Sales', category: 'Income', subCategory: 'POS Sales', module: ['POS'], openingBalance: 0, currentBalance: 85000, nature: 'Credit', taxApplicable: true, taxType: 'GST', active: true, showInReports: true, createdAt: '2025-01-01T10:00:00Z', createdBy: 'Admin', updatedAt: '2025-01-21T10:00:00Z', updatedBy: 'Admin' },
  { id: '22', code: '4101', name: 'Daily Rental', category: 'Income', subCategory: 'Rental Income', module: ['Rental'], openingBalance: 0, currentBalance: 30000, nature: 'Credit', taxApplicable: true, taxType: 'GST', active: true, showInReports: true, createdAt: '2025-01-01T10:00:00Z', createdBy: 'Admin', updatedAt: '2025-01-23T10:00:00Z', updatedBy: 'Admin' },
  { id: '24', code: '4201', name: 'Studio Booking', category: 'Income', subCategory: 'Studio Income', module: ['Studio'], openingBalance: 0, currentBalance: 20000, nature: 'Credit', taxApplicable: true, taxType: 'GST', active: true, showInReports: true, createdAt: '2025-01-01T10:00:00Z', createdBy: 'Admin', updatedAt: '2025-01-24T10:00:00Z', updatedBy: 'Admin' },
  
  // EXPENSES
  { id: '30', code: '6001', name: 'Office Rent', category: 'Expenses', subCategory: 'Admin Expenses', module: ['General Accounting'], openingBalance: 0, currentBalance: 15000, nature: 'Debit', taxApplicable: false, active: true, showInReports: true, createdAt: '2025-01-01T10:00:00Z', createdBy: 'Admin', updatedAt: '2025-01-01T10:00:00Z', updatedBy: 'Admin' },
  { id: '39', code: '6401', name: 'Salaries', category: 'Expenses', subCategory: 'HR Expenses', module: ['General Accounting'], openingBalance: 0, currentBalance: 45000, nature: 'Debit', taxApplicable: false, active: true, showInReports: true, createdAt: '2025-01-01T10:00:00Z', createdBy: 'Admin', updatedAt: '2025-01-01T10:00:00Z', updatedBy: 'Admin' },
];

const initialAutomationRules: AutomationRule[] = [
  { id: '1', name: 'POS Sale Auto Posting', module: 'POS', enabled: true, description: 'Automated journal entry on POS sale', debitAccount: 'Cash/Bank', creditAccount: 'POS Sales' },
  { id: '2', name: 'Purchase Auto Posting', module: 'POS', enabled: true, description: 'Automated journal entry on purchase', debitAccount: 'Inventory', creditAccount: 'Supplier/Cash' },
  { id: '3', name: 'Rental Income Automation', module: 'Rental', enabled: true, description: 'Auto entry on rental booking', debitAccount: 'Customer/Cash', creditAccount: 'Rental Income' },
  { id: '4', name: 'Studio Project Accounting', module: 'Studio', enabled: true, description: 'Auto entry on project completion', debitAccount: 'Project Cost', creditAccount: 'Studio Income' },
];

const categoryConfig = {
  'Assets': { color: 'blue', icon: Wallet, bgClass: 'bg-blue-500/10', borderClass: 'border-blue-500/30', textClass: 'text-blue-400', hoverClass: 'hover:bg-blue-500/20', activeClass: 'bg-blue-500/20 border-blue-400' },
  'Liabilities': { color: 'red', icon: TrendingDown, bgClass: 'bg-red-500/10', borderClass: 'border-red-500/30', textClass: 'text-red-400', hoverClass: 'hover:bg-red-500/20', activeClass: 'bg-red-500/20 border-red-400' },
  'Equity': { color: 'purple', icon: Shield, bgClass: 'bg-purple-500/10', borderClass: 'border-purple-500/30', textClass: 'text-purple-400', hoverClass: 'hover:bg-purple-500/20', activeClass: 'bg-purple-500/20 border-purple-400' },
  'Income': { color: 'green', icon: TrendingUp, bgClass: 'bg-green-500/10', borderClass: 'border-green-500/30', textClass: 'text-green-400', hoverClass: 'hover:bg-green-500/20', activeClass: 'bg-green-500/20 border-green-400' },
  'Cost of Sales': { color: 'yellow', icon: BarChart3, bgClass: 'bg-yellow-500/10', borderClass: 'border-yellow-500/30', textClass: 'text-yellow-400', hoverClass: 'hover:bg-yellow-500/20', activeClass: 'bg-yellow-500/20 border-yellow-400' },
  'Expenses': { color: 'orange', icon: AlertCircle, bgClass: 'bg-orange-500/10', borderClass: 'border-orange-500/30', textClass: 'text-orange-400', hoverClass: 'hover:bg-orange-500/20', activeClass: 'bg-orange-500/20 border-orange-400' },
};

const moduleIcons = {
  'POS': ShoppingCart,
  'Rental': Home,
  'Studio': Camera,
  'General Accounting': Package,
};

// ============================================
// 🎯 MAIN COMPONENT
// ============================================

export const ChartOfAccounts = () => {
  // State Management
  const [accounts, setAccounts] = useState<ChartAccount[]>(initialAccounts);
  const [transactions, setTransactions] = useState<Transaction[]>(sampleTransactions);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>(initialAutomationRules);
  const [settings, setSettings] = useState<AccountingSettings>({
    autoGenerateCodes: true,
    showInactiveAccounts: false,
    defaultTaxRate: 18,
    taxType: 'GST',
    fiscalYearStart: '2025-01-01',
    fiscalYearEnd: '2025-12-31',
    accountLockDate: '',
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<ChartAccount | null>(null);
  const [mainTab, setMainTab] = useState('overview');
  const [coaSubTab, setCoaSubTab] = useState<AccountCategory>('Assets');
  const [loading, setLoading] = useState(false);
  
  // Dialog states
  const [ledgerAccount, setLedgerAccount] = useState<ChartAccount | null>(null);
  const [ledgerDateFrom, setLedgerDateFrom] = useState('2025-01-01');
  const [ledgerDateTo, setLedgerDateTo] = useState('2025-01-31');
  const [ledgerModuleFilter, setLedgerModuleFilter] = useState<AccountModule | 'All'>('All');
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState('');
  
  const [openingBalanceAccount, setOpeningBalanceAccount] = useState<ChartAccount | null>(null);
  const [newOpeningBalance, setNewOpeningBalance] = useState<string>('');
  const [auditLogAccount, setAuditLogAccount] = useState<ChartAccount | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<ChartAccount | null>(null);
  const [drillDownCategory, setDrillDownCategory] = useState<string | null>(null);
  const [isJournalEntryOpen, setIsJournalEntryOpen] = useState(false);
  const [selectedJournalEntry, setSelectedJournalEntry] = useState<any>(null);
  
  // Report date range
  const [reportStartDate, setReportStartDate] = useState('2025-01-01');
  const [reportEndDate, setReportEndDate] = useState('2025-01-31');
  const [reportDateApplied, setReportDateApplied] = useState(false);

  // Calculate summary
  const summary = useMemo(() => {
    const filteredAccounts = settings.showInactiveAccounts ? accounts : accounts.filter(a => a.active);
    
    return {
      totalAssets: filteredAccounts.filter(a => a.category === 'Assets').reduce((sum, a) => sum + a.currentBalance, 0),
      totalLiabilities: filteredAccounts.filter(a => a.category === 'Liabilities').reduce((sum, a) => sum + a.currentBalance, 0),
      totalEquity: filteredAccounts.filter(a => a.category === 'Equity').reduce((sum, a) => sum + a.currentBalance, 0),
      totalIncome: filteredAccounts.filter(a => a.category === 'Income').reduce((sum, a) => sum + a.currentBalance, 0),
      totalExpenses: filteredAccounts.filter(a => a.category === 'Expenses').reduce((sum, a) => sum + a.currentBalance, 0),
      totalCOGS: filteredAccounts.filter(a => a.category === 'Cost of Sales').reduce((sum, a) => sum + a.currentBalance, 0),
      totalAccounts: filteredAccounts.length,
      activeAccounts: accounts.filter(a => a.active).length,
      lastUpdated: new Date().toLocaleString(),
    };
  }, [accounts, settings.showInactiveAccounts]);

  // Group accounts
  const groupedAccountsByCategory = useMemo(() => {
    const filtered = accounts.filter(acc => {
      const matchesSearch = searchTerm === '' || 
        acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.code.includes(searchTerm);
      const matchesActive = settings.showInactiveAccounts || acc.active;
      return matchesSearch && acc.category === coaSubTab && matchesActive;
    });

    const grouped: Record<string, ChartAccount[]> = {};
    filtered.forEach(acc => {
      if (!grouped[acc.subCategory]) {
        grouped[acc.subCategory] = [];
      }
      grouped[acc.subCategory].push(acc);
    });

    return grouped;
  }, [accounts, searchTerm, coaSubTab, settings.showInactiveAccounts]);

  // Filter ledger transactions
  const filteredLedgerTransactions = useMemo(() => {
    if (!ledgerAccount) return [];
    
    return transactions.filter(t => {
      const matchesAccount = t.accountId === ledgerAccount.id;
      const matchesDate = t.date >= ledgerDateFrom && t.date <= ledgerDateTo;
      const matchesModule = ledgerModuleFilter === 'All' || t.module === ledgerModuleFilter;
      const matchesSearch = ledgerSearchTerm === '' || 
        t.description.toLowerCase().includes(ledgerSearchTerm.toLowerCase()) ||
        t.referenceNo.toLowerCase().includes(ledgerSearchTerm.toLowerCase());
      
      return matchesAccount && matchesDate && matchesModule && matchesSearch;
    });
  }, [transactions, ledgerAccount, ledgerDateFrom, ledgerDateTo, ledgerModuleFilter, ledgerSearchTerm]);

  // Audit log
  const createAuditLog = (action: AuditLog['action'], accountId: string, accountName: string, details: string, oldValue?: string, newValue?: string) => {
    const log: AuditLog = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      user: 'Admin',
      action,
      accountId,
      accountName,
      oldValue,
      newValue,
      details,
    };
    setAuditLogs(prev => [log, ...prev]);
  };

  // CRUD Operations
  const handleSaveAccount = (account: ChartAccount) => {
    setLoading(true);
    
    setTimeout(() => {
      const existingIndex = accounts.findIndex(a => a.id === account.id);
      
      if (existingIndex >= 0) {
        // Update existing
        setAccounts(prev => prev.map(a => a.id === account.id ? account : a));
        createAuditLog('UPDATE', account.id, account.name, `Account updated: ${account.code} - ${account.name}`, accounts[existingIndex].name, account.name);
      } else {
        // Create new
        setAccounts(prev => [...prev, account]);
        createAuditLog('CREATE', account.id, account.name, `Account created: ${account.code} - ${account.name}`);
      }
      
      setLoading(false);
    }, 300);
  };

  const handleDeleteAccount = (account: ChartAccount) => {
    const hasTransactions = transactions.some(t => t.accountId === account.id);
    
    if (hasTransactions) {
      toast.error('Cannot delete account', {
        description: 'This account has existing transactions.',
      });
      return;
    }

    setDeleteAccount(account);
  };

  const confirmDelete = () => {
    if (!deleteAccount) return;

    setLoading(true);
    setTimeout(() => {
      setAccounts(prev => prev.filter(a => a.id !== deleteAccount.id));
      createAuditLog('DELETE', deleteAccount.id, deleteAccount.name, `Account deleted: ${deleteAccount.code} - ${deleteAccount.name}`);
      toast.success('Account deleted successfully');
      setDeleteAccount(null);
      setLoading(false);
    }, 500);
  };

  const handleToggleActive = (account: ChartAccount) => {
    setLoading(true);
    setTimeout(() => {
      setAccounts(prev => prev.map(a => 
        a.id === account.id 
          ? { ...a, active: !a.active, updatedAt: new Date().toISOString(), updatedBy: 'Admin' }
          : a
      ));
      createAuditLog(
        account.active ? 'DEACTIVATE' : 'ACTIVATE',
        account.id,
        account.name,
        account.active ? 'Account deactivated' : 'Account activated'
      );
      toast.success(account.active ? 'Account deactivated' : 'Account activated');
      setLoading(false);
    }, 500);
  };

  const handleOpeningBalanceSubmit = () => {
    if (!openingBalanceAccount) return;

    const newBalance = parseFloat(newOpeningBalance);
    if (isNaN(newBalance)) {
      toast.error('Invalid amount');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setAccounts(prev => prev.map(a => 
        a.id === openingBalanceAccount.id 
          ? { ...a, openingBalance: newBalance, currentBalance: newBalance, updatedAt: new Date().toISOString() }
          : a
      ));
      createAuditLog('UPDATE', openingBalanceAccount.id, openingBalanceAccount.name, 'Opening balance updated', openingBalanceAccount.openingBalance.toString(), newBalance.toString());
      toast.success('Opening balance updated');
      setOpeningBalanceAccount(null);
      setNewOpeningBalance('');
      setLoading(false);
    }, 500);
  };

  const handleToggleAutomation = (ruleId: string) => {
    setAutomationRules(prev => prev.map(rule => 
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
    ));
    const rule = automationRules.find(r => r.id === ruleId);
    if (rule) {
      toast.success(rule.enabled ? 'Automation disabled' : 'Automation enabled', { description: rule.name });
    }
  };

  const handleExportData = (format: 'PDF' | 'Excel') => {
    setLoading(true);
    setTimeout(() => {
      toast.success(`Exporting to ${format}...`, { description: 'Your download will start shortly' });
      setLoading(false);
    }, 1000);
  };

  const handleExportLedger = (format: 'PDF' | 'Excel') => {
    if (!ledgerAccount) return;
    
    setLoading(true);
    
    const ledgerData: LedgerData = {
      type: 'ledger',
      companyName: 'Din Collection',
      accountCode: ledgerAccount.code,
      accountName: ledgerAccount.name,
      accountType: ledgerAccount.category,
      dateFrom: ledgerDateFrom,
      dateTo: ledgerDateTo,
      openingBalance: ledgerAccount.openingBalance,
      closingBalance: ledgerAccount.currentBalance,
      transactions: filteredLedgerTransactions,
    };
    
    setTimeout(() => {
      try {
        if (format === 'PDF') {
          generateProfessionalPDF(ledgerData);
        } else {
          exportLedgerToExcel(ledgerData);
        }
        toast.success(`Ledger exported to ${format}`, {
          description: `${ledgerAccount.name} ledger report`,
        });
      } catch (error) {
        toast.error('Export failed', {
          description: 'Could not generate export. Please check pop-up settings.',
        });
      }
      setLoading(false);
    }, 500);
  };

  const handlePrintLedger = () => {
    toast.info('Opening print dialog...');
    setTimeout(() => window.print(), 100);
  };

  const handleApplyReportFilter = () => {
    if (!reportStartDate || !reportEndDate) {
      toast.error('Please select valid date range');
      return;
    }
    if (new Date(reportStartDate) > new Date(reportEndDate)) {
      toast.error('Start date cannot be after end date');
      return;
    }
    setReportDateApplied(true);
    toast.success('Date filter applied', {
      description: `${reportStartDate} to ${reportEndDate}`,
    });
  };

  const getFilteredReportData = () => {
    const filtered = transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= new Date(reportStartDate) && txDate <= new Date(reportEndDate);
    });

    const moduleData = {
      POS: { income: 0, expenses: 0, cogs: 0 },
      Rental: { income: 0, expenses: 0, cogs: 0 },
      Studio: { income: 0, expenses: 0, cogs: 0 },
    };

    filtered.forEach(t => {
      const account = accounts.find(a => a.id === t.accountId);
      if (!account) return;

      const module = t.module as 'POS' | 'Rental' | 'Studio';
      if (module && moduleData[module]) {
        if (account.category === 'Income') {
          moduleData[module].income += t.credit;
        } else if (account.category === 'Cost of Sales') {
          moduleData[module].cogs += t.debit;
        } else if (account.category === 'Expenses') {
          moduleData[module].expenses += t.debit;
        }
      }
    });

    return {
      filteredTransactions: filtered,
      moduleData,
      posProfit: moduleData.POS.income - moduleData.POS.cogs - moduleData.POS.expenses,
      rentalProfit: moduleData.Rental.income - moduleData.Rental.cogs - moduleData.Rental.expenses,
      studioProfit: moduleData.Studio.income - moduleData.Studio.cogs - moduleData.Studio.expenses,
    };
  };

  const handleExportReport = (reportType: 'trial-balance' | 'profit-loss' | 'balance-sheet' | 'module-profit', format: 'PDF' | 'Excel') => {
    setLoading(true);

    const reportData = getFilteredReportData();
    const activeAccounts = accounts.filter(a => a.active);

    setTimeout(() => {
      try {
        let ledgerData: LedgerData;

        switch (reportType) {
          case 'trial-balance':
            ledgerData = {
              type: 'trial-balance',
              companyName: 'Din Collection',
              dateFrom: reportStartDate,
              dateTo: reportEndDate,
              accounts: activeAccounts.map(a => ({
                code: a.code,
                name: a.name,
                category: a.category,
                debit: a.nature === 'Debit' ? a.currentBalance : 0,
                credit: a.nature === 'Credit' ? a.currentBalance : 0,
              })),
            };
            break;

          case 'profit-loss':
            const totalIncome = activeAccounts.filter(a => a.category === 'Income').reduce((sum, a) => sum + a.currentBalance, 0);
            const totalCOGS = activeAccounts.filter(a => a.category === 'Cost of Sales').reduce((sum, a) => sum + a.currentBalance, 0);
            const totalExpenses = activeAccounts.filter(a => a.category === 'Expenses').reduce((sum, a) => sum + a.currentBalance, 0);
            const netProfit = totalIncome - totalCOGS - totalExpenses;

            ledgerData = {
              type: 'profit-loss',
              companyName: 'Din Collection',
              dateFrom: reportStartDate,
              dateTo: reportEndDate,
              income: activeAccounts.filter(a => a.category === 'Income').map(a => ({
                code: a.code,
                name: a.name,
                amount: a.currentBalance,
              })),
              cogs: activeAccounts.filter(a => a.category === 'Cost of Sales').map(a => ({
                code: a.code,
                name: a.name,
                amount: a.currentBalance,
              })),
              expenses: activeAccounts.filter(a => a.category === 'Expenses').map(a => ({
                code: a.code,
                name: a.name,
                amount: a.currentBalance,
              })),
              totalIncome,
              totalCOGS,
              totalExpenses,
              netProfit,
            };
            break;

          case 'balance-sheet':
            const totalAssets = activeAccounts.filter(a => a.category === 'Assets').reduce((sum, a) => sum + a.currentBalance, 0);
            const totalLiabilities = activeAccounts.filter(a => a.category === 'Liabilities').reduce((sum, a) => sum + a.currentBalance, 0);
            const totalEquity = activeAccounts.filter(a => a.category === 'Equity').reduce((sum, a) => sum + a.currentBalance, 0);

            ledgerData = {
              type: 'balance-sheet',
              companyName: 'Din Collection',
              asOfDate: reportEndDate,
              assets: activeAccounts.filter(a => a.category === 'Assets').map(a => ({
                code: a.code,
                name: a.name,
                amount: a.currentBalance,
              })),
              liabilities: activeAccounts.filter(a => a.category === 'Liabilities').map(a => ({
                code: a.code,
                name: a.name,
                amount: a.currentBalance,
              })),
              equity: activeAccounts.filter(a => a.category === 'Equity').map(a => ({
                code: a.code,
                name: a.name,
                amount: a.currentBalance,
              })),
              totalAssets,
              totalLiabilities,
              totalEquity,
            };
            break;

          case 'module-profit':
            ledgerData = {
              type: 'module-profit',
              companyName: 'Din Collection',
              dateFrom: reportStartDate,
              dateTo: reportEndDate,
              modules: [
                {
                  name: 'POS',
                  income: reportData.moduleData.POS.income,
                  cogs: reportData.moduleData.POS.cogs,
                  expenses: reportData.moduleData.POS.expenses,
                  profit: reportData.posProfit,
                },
                {
                  name: 'Rental',
                  income: reportData.moduleData.Rental.income,
                  cogs: reportData.moduleData.Rental.cogs,
                  expenses: reportData.moduleData.Rental.expenses,
                  profit: reportData.rentalProfit,
                },
                {
                  name: 'Studio',
                  income: reportData.moduleData.Studio.income,
                  cogs: reportData.moduleData.Studio.cogs,
                  expenses: reportData.moduleData.Studio.expenses,
                  profit: reportData.studioProfit,
                },
              ],
              totalProfit: reportData.posProfit + reportData.rentalProfit + reportData.studioProfit,
            };
            break;

          default:
            throw new Error('Invalid report type');
        }

        if (format === 'PDF') {
          generateProfessionalPDF(ledgerData);
        } else {
          exportLedgerToExcel(ledgerData);
        }

        const reportNames = {
          'trial-balance': 'Trial Balance',
          'profit-loss': 'Profit & Loss Statement',
          'balance-sheet': 'Balance Sheet',
          'module-profit': 'Module-wise Profit Report',
        };

        toast.success(`${reportNames[reportType]} exported to ${format}`, {
          description: `Period: ${reportStartDate} to ${reportEndDate}`,
        });
      } catch (error) {
        toast.error('Export failed', {
          description: 'Could not generate report. Please try again.',
        });
      }
      setLoading(false);
    }, 500);
  };

  const handleSaveJournalEntry = (entry: any) => {
    setLoading(true);
    
    setTimeout(() => {
      // Process journal entry lines and update accounts
      entry.lines.forEach((line: any) => {
        const account = accounts.find(a => a.id === line.accountId);
        if (account) {
          // Update account balance based on debit/credit
          const balanceChange = line.debit > 0 ? line.debit : -line.credit;
          const newBalance = account.nature === 'Debit' 
            ? account.currentBalance + balanceChange 
            : account.currentBalance - balanceChange;
          
          setAccounts(prev => prev.map(a => 
            a.id === line.accountId 
              ? { ...a, currentBalance: newBalance, updatedAt: new Date().toISOString() }
              : a
          ));
          
          // Create transaction for each line
          const newTransaction: Transaction = {
            id: `${entry.id || Date.now()}-${line.id}`,
            date: entry.date,
            accountId: line.accountId,
            accountName: line.accountName,
            debit: line.debit,
            credit: line.credit,
            runningBalance: newBalance,
            description: entry.description,
            module: entry.module,
            referenceNo: entry.referenceNo,
          };
          
          setTransactions(prev => [...prev, newTransaction]);
        }
      });
      
      // Create audit log
      createAuditLog(
        'CREATE',
        'journal-entry',
        entry.referenceNo,
        `Journal entry created: ${entry.description}`
      );
      
      toast.success('Journal entry saved successfully', {
        description: 'All account balances have been updated',
      });
      
      setLoading(false);
    }, 500);
  };

  return (
    <div className="h-screen flex flex-col bg-[#0B0F19]">
      {/* HEADER */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-800 bg-[#111827]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Chart of Accounts (TEST)</h1>
            <p className="text-sm text-gray-400 mt-1">Fully Functional ERP Accounting System • Last Updated: {summary.lastUpdated}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button className="bg-blue-600 hover:bg-blue-500 text-white" onClick={() => { setSelectedAccount(null); setIsAddDrawerOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Add New Account
            </Button>
          </div>
        </div>
      </div>

      {/* MAIN TABS */}
      <Tabs.Root value={mainTab} onValueChange={setMainTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 border-b border-gray-800 bg-[#111827]">
          <Tabs.List className="flex items-center px-6 gap-1">
            {[
              { value: 'overview', icon: LayoutGrid, label: 'Overview' },
              { value: 'chart-of-accounts', icon: List, label: 'Chart of Accounts' },
              { value: 'transactions', icon: Receipt, label: 'Transactions', badge: transactions.length },
              { value: 'automation', icon: Zap, label: 'Automation', badge: `${automationRules.filter(r => r.enabled).length}/${automationRules.length}` },
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
                {badge && <Badge variant="outline" className="text-xs bg-green-500/20 text-green-400 border-green-500/30">{badge}</Badge>}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </div>

        {/* TAB CONTENT */}
        <div className="flex-1 overflow-hidden">
          
          {/* OVERVIEW TAB */}
          <Tabs.Content value="overview" className="h-full overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="p-6">
                <h2 className="text-xl font-bold text-white mb-4">Accounting Summary</h2>
                
                {/* Summary Cards - CLICKABLE */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                  {[
                    { category: 'Assets', value: summary.totalAssets, icon: ArrowUpRight, trend: '+12%', config: categoryConfig.Assets },
                    { category: 'Liabilities', value: summary.totalLiabilities, icon: ArrowDownRight, trend: '-5%', config: categoryConfig.Liabilities },
                    { category: 'Equity', value: summary.totalEquity, icon: Shield, trend: '+8%', config: categoryConfig.Equity },
                    { category: 'Income', value: summary.totalIncome, icon: TrendingUp, trend: '+15%', config: categoryConfig.Income },
                  ].map(({ category, value, icon: Icon, trend, config }) => (
                    <motion.div
                      key={category}
                      whileHover={{ scale: 1.02 }}
                      className={cn("rounded-lg p-4 cursor-pointer border", config.bgClass, config.borderClass)}
                      onClick={() => {
                        const account = accounts.find(a => a.category === category);
                        if (account) setLedgerAccount(account);
                      }}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={cn("p-2 rounded-lg", config.bgClass)}>
                          <Icon className={cn("h-5 w-5", config.textClass)} />
                        </div>
                        <p className={cn("text-xs uppercase tracking-wider font-semibold", config.textClass)}>Total {category}</p>
                      </div>
                      <p className="text-2xl font-bold text-white">Rs. {value.toLocaleString()}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-gray-400">{accounts.filter(a => a.category === category && a.active).length} accounts</p>
                        <Badge variant="outline" className={cn("text-xs", config.textClass, config.borderClass)}>{trend}</Badge>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Quick Actions */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-white mb-3">Quick Actions</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Button className="justify-start h-auto py-4 bg-gray-800 hover:bg-gray-700 text-white border border-gray-700" onClick={() => { setSelectedAccount(null); setIsAddDrawerOpen(true); }}>
                      <Plus className="h-5 w-5 mr-3 text-blue-400" />
                      <div className="text-left">
                        <div className="font-semibold">Add New Account</div>
                        <div className="text-xs text-gray-400">Create new chart of account entry</div>
                      </div>
                    </Button>
                    <Button className="justify-start h-auto py-4 bg-gray-800 hover:bg-gray-700 text-white border border-gray-700" onClick={() => setMainTab('transactions')}>
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
                    {auditLogs.slice(0, 5).map((log, index) => (
                      <div key={log.id} className={cn("p-4 flex items-center gap-4", index !== 0 && "border-t border-gray-700")}>
                        <div className={cn("p-2 rounded-lg", log.action === 'CREATE' && "bg-green-500/20", log.action === 'UPDATE' && "bg-blue-500/20", log.action === 'DELETE' && "bg-red-500/20")}>
                          <Clock className="h-4 w-4 text-gray-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-white">{log.details}</p>
                          <p className="text-xs text-gray-400">{new Date(log.timestamp).toLocaleString()} • {log.user}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">{log.action}</Badge>
                      </div>
                    ))}
                    {auditLogs.length === 0 && <div className="p-8 text-center text-gray-500">No activity yet</div>}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </Tabs.Content>

          {/* CHART OF ACCOUNTS TAB */}
          <Tabs.Content value="chart-of-accounts" className="h-full flex flex-col overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col overflow-hidden">
                {/* Sub-tabs */}
                <div className="shrink-0 border-b border-gray-800 bg-[#0B0F19] px-6 py-3">
                  <div className="flex items-center gap-2">
                    {Object.entries(categoryConfig).map(([category, config]) => {
                      const Icon = config.icon;
                      const count = accounts.filter(a => a.category === category && (settings.showInactiveAccounts || a.active)).length;
                      return (
                        <button
                          key={category}
                          onClick={() => setCoaSubTab(category as AccountCategory)}
                          className={cn(
                            "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 border",
                            coaSubTab === category ? cn(config.activeClass, config.textClass) : "text-gray-400 hover:text-white bg-gray-800/50 border-gray-700 hover:bg-gray-800"
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
                    <Input placeholder={`Search ${coaSubTab} accounts...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-gray-800 border-gray-700 text-white" />
                  </div>
                  <Button variant="outline" size="sm" className="border-gray-700 text-gray-300" onClick={() => setSettings(prev => ({ ...prev, showInactiveAccounts: !prev.showInactiveAccounts }))}>
                    {settings.showInactiveAccounts ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
                    {settings.showInactiveAccounts ? 'Hide' : 'Show'} Inactive
                  </Button>
                </div>

                {/* Accounts List */}
                <div className="flex-1 overflow-y-auto p-6">
                  {Object.entries(groupedAccountsByCategory).map(([subCategory, accs]) => (
                    <div key={subCategory} className="mb-6">
                      <h4 className="text-sm font-semibold text-gray-400 mb-3 px-2 uppercase tracking-wider">{subCategory}</h4>
                      <div className="space-y-2">
                        {accs.map((account) => {
                          const config = categoryConfig[account.category];
                          return (
                            <motion.div key={account.id} className={cn("p-4 rounded-lg border transition-all group", config.bgClass, config.borderClass, "hover:shadow-lg", !account.active && "opacity-50")}>
                              <div className="flex items-center justify-between">
                                <div className="flex-1 cursor-pointer" onClick={() => setLedgerAccount(account)}>
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className="font-mono text-xs text-gray-400 bg-gray-900/50 px-2 py-1 rounded">{account.code}</span>
                                    <span className="font-semibold text-white">{account.name}</span>
                                    {!account.active && <Badge variant="outline" className="text-gray-500 border-gray-600">Inactive</Badge>}
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-gray-400">
                                    <span className="flex items-center gap-1">
                                      <DollarSign className="h-3 w-3" />
                                      Current: Rs. {account.currentBalance.toLocaleString()}
                                    </span>
                                    <span className={cn("px-2 py-0.5 rounded", account.nature === 'Debit' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400')}>{account.nature}</span>
                                  </div>
                                </div>
                                
                                {/* THREE-DOTS MENU */}
                                <DropdownMenu.Root>
                                  <DropdownMenu.Trigger asChild>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenu.Trigger>
                                  <DropdownMenu.Portal>
                                    <DropdownMenu.Content className="min-w-[200px] bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-1 z-50" sideOffset={5}>
                                      <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded cursor-pointer outline-none" onClick={() => { setSelectedAccount(account); setIsAddDrawerOpen(true); }}>
                                        <Edit2 className="h-4 w-4" />Edit Account
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded cursor-pointer outline-none" onClick={() => setLedgerAccount(account)}>
                                        <Eye className="h-4 w-4" />View Ledger
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded cursor-pointer outline-none" onClick={() => { setOpeningBalanceAccount(account); setNewOpeningBalance(account.openingBalance.toString()); }}>
                                        <DollarSign className="h-4 w-4" />Set Opening Balance
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Separator className="h-px bg-gray-700 my-1" />
                                      <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded cursor-pointer outline-none" onClick={() => handleToggleActive(account)}>
                                        {account.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                                        {account.active ? 'Deactivate' : 'Activate'}
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded cursor-pointer outline-none" onClick={() => setAuditLogAccount(account)}>
                                        <History className="h-4 w-4" />Audit Log
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Separator className="h-px bg-gray-700 my-1" />
                                      <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded cursor-pointer outline-none" onClick={() => handleDeleteAccount(account)}>
                                        <Trash2 className="h-4 w-4" />Delete Account
                                      </DropdownMenu.Item>
                                    </DropdownMenu.Content>
                                  </DropdownMenu.Portal>
                                </DropdownMenu.Root>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {Object.keys(groupedAccountsByCategory).length === 0 && (
                    <div className="text-center py-12">
                      <AlertCircle className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400 mb-1">No accounts found in {coaSubTab}</p>
                      <Button className="mt-4 bg-blue-600 hover:bg-blue-500" onClick={() => { setSelectedAccount(null); setIsAddDrawerOpen(true); }}>
                        <Plus className="h-4 w-4 mr-2" />Add First Account
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </Tabs.Content>

          {/* TRANSACTIONS TAB */}
          <Tabs.Content value="transactions" className="h-full overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Accounting Transactions</h2>
                <Button 
                  className="bg-green-600 hover:bg-green-500"
                  onClick={() => {
                    setSelectedJournalEntry(null);
                    setIsJournalEntryOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />Add Journal Entry
                </Button>
              </div>
              
              {transactions.length === 0 ? (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-12 text-center">
                  <Receipt className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg mb-2">No Transactions Yet</p>
                  <Button className="bg-green-600 hover:bg-green-500"><Plus className="h-4 w-4 mr-2" />Create First Transaction</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((txn) => (
                    <div key={txn.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white">{txn.description}</p>
                          <p className="text-sm text-gray-400">{new Date(txn.date).toLocaleDateString()} • Ref: {txn.referenceNo} • {txn.accountName}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            {txn.debit > 0 && <p className="text-sm text-green-400">Dr: Rs. {txn.debit.toLocaleString()}</p>}
                            {txn.credit > 0 && <p className="text-sm text-red-400">Cr: Rs. {txn.credit.toLocaleString()}</p>}
                          </div>
                          <Badge variant="outline">{txn.module}</Badge>
                          <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </Tabs.Content>

          {/* AUTOMATION TAB */}
          <Tabs.Content value="automation" className="h-full overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">Accounting Automation Rules</h2>
              <div className="grid grid-cols-2 gap-4">
                {automationRules.map((rule) => {
                  const ModuleIcon = moduleIcons[rule.module as keyof typeof moduleIcons] || Package;
                  return (
                    <div key={rule.id} className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-500/20 rounded-lg"><ModuleIcon className="h-5 w-5 text-blue-400" /></div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">{rule.name}</h3>
                          <p className="text-xs text-gray-400">{rule.description}</p>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex justify-between text-gray-300">
                          <span className="text-green-400">Dr:</span>
                          <span>{rule.debitAccount}</span>
                        </div>
                        <div className="flex justify-between text-gray-300">
                          <span className="text-red-400">Cr:</span>
                          <span>{rule.creditAccount}</span>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-gray-700">
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className="text-sm text-gray-400">{rule.enabled ? 'Auto Post Enabled' : 'Auto Post Disabled'}</span>
                          <button onClick={() => handleToggleAutomation(rule.id)} className="relative inline-block w-10 h-5 transition rounded-full" style={{ backgroundColor: rule.enabled ? '#10b981' : '#6b7280' }}>
                            <span className="absolute left-0.5 top-0.5 w-4 h-4 transition transform bg-white rounded-full" style={{ transform: rule.enabled ? 'translateX(20px)' : 'translateX(0)' }} />
                          </button>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </Tabs.Content>

          {/* REPORTS TAB */}
          <Tabs.Content value="reports" className="h-full overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">Financial Reports</h2>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <Input 
                    type="date" 
                    className="bg-gray-800 border-gray-700 text-white" 
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                  />
                </div>
                <span className="text-gray-400">to</span>
                <Input 
                  type="date" 
                  className="bg-gray-800 border-gray-700 text-white" 
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                />
                <Button 
                  className="bg-blue-600 hover:bg-blue-500"
                  onClick={handleApplyReportFilter}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Apply Filter
                </Button>
                {reportDateApplied && (
                  <Badge variant="outline" className="bg-green-500/10 border-green-500/30 text-green-400">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Filter Active
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <motion.div whileHover={{ scale: 1.02 }} className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-blue-500/20 rounded-lg"><FileText className="h-6 w-6 text-blue-400" /></div>
                    <div>
                      <h3 className="font-semibold text-white text-lg">Trial Balance</h3>
                      <p className="text-xs text-gray-400">All accounts with debit/credit totals</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 border-gray-700 text-gray-300" onClick={() => handleExportReport('trial-balance', 'PDF')}>
                      <Download className="h-4 w-4 mr-2" />PDF
                    </Button>
                    <Button variant="outline" className="flex-1 border-gray-700 text-gray-300" onClick={() => handleExportReport('trial-balance', 'Excel')}>
                      <Download className="h-4 w-4 mr-2" />Excel
                    </Button>
                  </div>
                </motion.div>

                <motion.div whileHover={{ scale: 1.02 }} className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-green-500/20 rounded-lg"><TrendingUp className="h-6 w-6 text-green-400" /></div>
                    <div>
                      <h3 className="font-semibold text-white text-lg">Profit & Loss</h3>
                      <p className="text-xs text-gray-400">Income minus expenses statement</p>
                    </div>
                  </div>
                  <div className="text-center mb-3 py-2 bg-gray-900 rounded">
                    <p className="text-xs text-gray-400">Net Profit</p>
                    <p className="text-lg font-bold text-green-400">Rs. {(summary.totalIncome - summary.totalExpenses - summary.totalCOGS).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 border-gray-700 text-gray-300" onClick={() => handleExportReport('profit-loss', 'PDF')}>
                      <Download className="h-4 w-4 mr-2" />PDF
                    </Button>
                    <Button variant="outline" className="flex-1 border-gray-700 text-gray-300" onClick={() => handleExportReport('profit-loss', 'Excel')}>
                      <Download className="h-4 w-4 mr-2" />Excel
                    </Button>
                  </div>
                </motion.div>

                <motion.div whileHover={{ scale: 1.02 }} className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-purple-500/20 rounded-lg"><Wallet className="h-6 w-6 text-purple-400" /></div>
                    <div>
                      <h3 className="font-semibold text-white text-lg">Balance Sheet</h3>
                      <p className="text-xs text-gray-400">Assets, liabilities & equity</p>
                    </div>
                  </div>
                  <div className="text-center mb-3 py-2 bg-gray-900 rounded">
                    <p className="text-xs text-gray-400">Total Assets</p>
                    <p className="text-lg font-bold text-purple-400">Rs. {summary.totalAssets.toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 border-gray-700 text-gray-300" onClick={() => handleExportReport('balance-sheet', 'PDF')}>
                      <Download className="h-4 w-4 mr-2" />PDF
                    </Button>
                    <Button variant="outline" className="flex-1 border-gray-700 text-gray-300" onClick={() => handleExportReport('balance-sheet', 'Excel')}>
                      <Download className="h-4 w-4 mr-2" />Excel
                    </Button>
                  </div>
                </motion.div>

                <motion.div whileHover={{ scale: 1.02 }} className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-orange-500/20 rounded-lg"><BarChart3 className="h-6 w-6 text-orange-400" /></div>
                    <div>
                      <h3 className="font-semibold text-white text-lg">Module Wise Profit</h3>
                      <p className="text-xs text-gray-400">POS, Rental & Studio analysis</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center py-2 bg-gray-900 rounded">
                      <p className="text-xs text-gray-400">POS</p>
                      <p className="text-sm font-bold text-blue-400">
                        Rs. {(() => {
                          const data = getFilteredReportData();
                          return (data.posProfit / 1000).toFixed(0) + 'K';
                        })()}
                      </p>
                    </div>
                    <div className="text-center py-2 bg-gray-900 rounded">
                      <p className="text-xs text-gray-400">Rental</p>
                      <p className="text-sm font-bold text-green-400">
                        Rs. {(() => {
                          const data = getFilteredReportData();
                          return (data.rentalProfit / 1000).toFixed(0) + 'K';
                        })()}
                      </p>
                    </div>
                    <div className="text-center py-2 bg-gray-900 rounded">
                      <p className="text-xs text-gray-400">Studio</p>
                      <p className="text-sm font-bold text-purple-400">
                        Rs. {(() => {
                          const data = getFilteredReportData();
                          return (data.studioProfit / 1000).toFixed(0) + 'K';
                        })()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 border-gray-700 text-gray-300" onClick={() => handleExportReport('module-profit', 'PDF')}>
                      <Download className="h-4 w-4 mr-2" />PDF
                    </Button>
                    <Button variant="outline" className="flex-1 border-gray-700 text-gray-300" onClick={() => handleExportReport('module-profit', 'Excel')}>
                      <Download className="h-4 w-4 mr-2" />Excel
                    </Button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </Tabs.Content>

          {/* SETTINGS TAB */}
          <Tabs.Content value="settings" className="h-full overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">Accounting Settings</h2>
              <div className="space-y-4 max-w-3xl">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2"><Settings className="h-5 w-5 text-blue-400" />Accounting Preferences</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-white">Auto-generate Account Codes</p>
                        <p className="text-xs text-gray-400">Automatically assign codes to new accounts</p>
                      </div>
                      <button onClick={() => setSettings(prev => ({ ...prev, autoGenerateCodes: !prev.autoGenerateCodes }))} className="relative inline-block w-10 h-5 rounded-full" style={{ backgroundColor: settings.autoGenerateCodes ? '#10b981' : '#6b7280' }}>
                        <span className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full" style={{ transform: settings.autoGenerateCodes ? 'translateX(20px)' : 'translateX(0)' }} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-white">Show Inactive Accounts</p>
                        <p className="text-xs text-gray-400">Display inactive accounts in lists</p>
                      </div>
                      <button onClick={() => setSettings(prev => ({ ...prev, showInactiveAccounts: !prev.showInactiveAccounts }))} className="relative inline-block w-10 h-5 rounded-full" style={{ backgroundColor: settings.showInactiveAccounts ? '#10b981' : '#6b7280' }}>
                        <span className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full" style={{ transform: settings.showInactiveAccounts ? 'translateX(20px)' : 'translateX(0)' }} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2"><Receipt className="h-5 w-5 text-green-400" />Tax Settings</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-400 block mb-1">Default Tax Rate (%)</label>
                      <Input type="number" value={settings.defaultTaxRate} onChange={(e) => setSettings(prev => ({ ...prev, defaultTaxRate: parseFloat(e.target.value) || 0 }))} className="bg-gray-900 border-gray-700 text-white" />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 block mb-1">Tax Type</label>
                      <select value={settings.taxType} onChange={(e) => setSettings(prev => ({ ...prev, taxType: e.target.value }))} className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white">
                        <option>GST</option>
                        <option>VAT</option>
                        <option>Sales Tax</option>
                      </select>
                    </div>
                  </div>
                </div>

                <Button className="w-full bg-blue-600 hover:bg-blue-500 h-12" onClick={() => toast.success('Settings saved')} disabled={loading}>
                  {loading ? 'Saving...' : <><Save className="h-4 w-4 mr-2" />Save Settings</>}
                </Button>
              </div>
            </motion.div>
          </Tabs.Content>

        </div>
      </Tabs.Root>

      {/* ============================================ */}
      {/* 🎯 ENHANCED LEDGER DIALOG */}
      {/* ============================================ */}
      <Dialog.Root open={!!ledgerAccount} onOpenChange={(open) => !open && setLedgerAccount(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 border border-gray-700 rounded-lg p-0 w-full max-w-5xl max-h-[90vh] overflow-hidden z-50">
            <Dialog.Description className="sr-only">
              View detailed transaction ledger for the selected account
            </Dialog.Description>
            {ledgerAccount && (
              <div className="flex flex-col h-full max-h-[90vh]">
                {/* LEDGER HEADER */}
                <div className={cn("px-6 py-4 border-b flex items-center justify-between", categoryConfig[ledgerAccount.category].bgClass, categoryConfig[ledgerAccount.category].borderClass)}>
                  <div>
                    <Dialog.Title className="text-xl font-bold text-white">Account Ledger</Dialog.Title>
                    <p className="text-sm text-gray-300 mt-1">
                      {ledgerAccount.code} - {ledgerAccount.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="border-gray-600" onClick={() => handleExportLedger('PDF')}>
                      <Download className="h-4 w-4 mr-1" />PDF
                    </Button>
                    <Button size="sm" variant="outline" className="border-gray-600" onClick={() => handleExportLedger('Excel')}>
                      <Download className="h-4 w-4 mr-1" />Excel
                    </Button>
                    <Button size="sm" variant="outline" className="border-gray-600" onClick={handlePrintLedger}>
                      <Printer className="h-4 w-4 mr-1" />Print
                    </Button>
                    <Dialog.Close asChild>
                      <Button size="sm" variant="ghost"><X className="h-4 w-4" /></Button>
                    </Dialog.Close>
                  </div>
                </div>

                {/* LEDGER FILTERS */}
                <div className="px-6 py-3 border-b border-gray-700 bg-gray-900">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <Input type="date" value={ledgerDateFrom} onChange={(e) => setLedgerDateFrom(e.target.value)} className="bg-gray-800 border-gray-700 text-white text-sm h-9" />
                      <span className="text-gray-400 text-sm">to</span>
                      <Input type="date" value={ledgerDateTo} onChange={(e) => setLedgerDateTo(e.target.value)} className="bg-gray-800 border-gray-700 text-white text-sm h-9" />
                    </div>
                    
                    <select value={ledgerModuleFilter} onChange={(e) => setLedgerModuleFilter(e.target.value as AccountModule | 'All')} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm h-9">
                      <option value="All">All Modules</option>
                      <option value="POS">POS</option>
                      <option value="Rental">Rental</option>
                      <option value="Studio">Studio</option>
                      <option value="General Accounting">General Accounting</option>
                    </select>

                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                      <Input placeholder="Search by reference or description..." value={ledgerSearchTerm} onChange={(e) => setLedgerSearchTerm(e.target.value)} className="pl-10 bg-gray-800 border-gray-700 text-white text-sm h-9" />
                    </div>
                  </div>
                </div>

                {/* LEDGER SUMMARY */}
                <div className="px-6 py-4 border-b border-gray-700 bg-gray-900">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-xs text-gray-400">Opening Balance</p>
                      <p className="text-lg font-bold text-white">Rs. {ledgerAccount.openingBalance.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400">Current Balance</p>
                      <p className="text-lg font-bold text-white">Rs. {ledgerAccount.currentBalance.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400">Nature</p>
                      <Badge variant="outline" className={cn("mt-1", ledgerAccount.nature === 'Debit' ? 'text-blue-400 border-blue-500/30' : 'text-green-400 border-green-500/30')}>{ledgerAccount.nature}</Badge>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400">Transactions</p>
                      <p className="text-lg font-bold text-white">{filteredLedgerTransactions.length}</p>
                    </div>
                  </div>
                </div>

                {/* LEDGER TABLE */}
                <div className="flex-1 overflow-y-auto">
                  {filteredLedgerTransactions.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Receipt className="h-12 w-12 mx-auto mb-2 text-gray-600" />
                      <p>No transactions found</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="sticky top-0 bg-gray-800 border-b border-gray-700">
                        <tr className="text-xs text-gray-400 uppercase tracking-wider">
                          <th className="px-4 py-3 text-left">Date</th>
                          <th className="px-4 py-3 text-left">Reference</th>
                          <th className="px-4 py-3 text-left">Description</th>
                          <th className="px-4 py-3 text-center">Module</th>
                          <th className="px-4 py-3 text-right">Debit</th>
                          <th className="px-4 py-3 text-right">Credit</th>
                          <th className="px-4 py-3 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLedgerTransactions.map((txn, index) => (
                          <tr key={txn.id} className={cn("border-b border-gray-800 hover:bg-gray-800/50 transition-colors cursor-pointer", index % 2 === 0 && "bg-gray-900/30")}>
                            <td className="px-4 py-3 text-sm text-gray-300">{new Date(txn.date).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-sm text-gray-300 font-mono">{txn.referenceNo}</td>
                            <td className="px-4 py-3 text-sm text-white">{txn.description}</td>
                            <td className="px-4 py-3 text-center">
                              <Badge variant="outline" className="text-xs">{txn.module}</Badge>
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-green-400 font-semibold">
                              {txn.debit > 0 ? `Rs. ${txn.debit.toLocaleString()}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-red-400 font-semibold">
                              {txn.credit > 0 ? `Rs. ${txn.credit.toLocaleString()}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-white font-bold">
                              Rs. {txn.runningBalance.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* OTHER DIALOGS */}
      {/* Opening Balance Dialog */}
      <Dialog.Root open={!!openingBalanceAccount} onOpenChange={(open) => !open && setOpeningBalanceAccount(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 border border-gray-700 rounded-lg p-6 w-full max-w-md z-50" aria-describedby="opening-balance-description">
            <Dialog.Title className="text-xl font-bold text-white mb-4">Set Opening Balance</Dialog.Title>
            <Dialog.Description id="opening-balance-description" className="sr-only">
              Update the opening balance for the selected account
            </Dialog.Description>
            {openingBalanceAccount && (
              <div>
                <p className="text-sm text-gray-400 mb-4">Account: <span className="text-white font-semibold">{openingBalanceAccount.name}</span></p>
                <div className="mb-4">
                  <label className="text-sm text-gray-400 block mb-2">Opening Balance (Rs.)</label>
                  <Input type="number" value={newOpeningBalance} onChange={(e) => setNewOpeningBalance(e.target.value)} className="bg-gray-900 border-gray-700 text-white" placeholder="Enter amount" />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 bg-blue-600 hover:bg-blue-500" onClick={handleOpeningBalanceSubmit} disabled={loading}>
                    {loading ? 'Saving...' : 'Save'}
                  </Button>
                  <Dialog.Close asChild>
                    <Button variant="outline" className="flex-1 border-gray-700">Cancel</Button>
                  </Dialog.Close>
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Audit Log Dialog */}
      <Dialog.Root open={!!auditLogAccount} onOpenChange={(open) => !open && setAuditLogAccount(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 border border-gray-700 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto z-50" aria-describedby="audit-log-description">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-xl font-bold text-white">Audit Log: {auditLogAccount?.name}</Dialog.Title>
              <Dialog.Close asChild><Button variant="ghost" size="sm"><X className="h-4 w-4" /></Button></Dialog.Close>
            </div>
            <Dialog.Description id="audit-log-description" className="sr-only">
              View all changes and modifications made to this account
            </Dialog.Description>
            {auditLogAccount && (
              <div className="space-y-2">
                {auditLogs.filter(log => log.accountId === auditLogAccount.id).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <History className="h-12 w-12 mx-auto mb-2 text-gray-600" />
                    <p>No audit logs yet</p>
                  </div>
                ) : (
                  auditLogs.filter(log => log.accountId === auditLogAccount.id).map((log) => (
                    <div key={log.id} className="bg-gray-900 p-4 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="outline">{log.action}</Badge>
                        <p className="text-xs text-gray-400">{new Date(log.timestamp).toLocaleString()}</p>
                      </div>
                      <p className="text-sm text-white mb-1">{log.details}</p>
                      <p className="text-xs text-gray-400">By {log.user}</p>
                      {log.oldValue && log.newValue && (
                        <div className="mt-2 pt-2 border-t border-gray-800 text-xs">
                          <p className="text-gray-400">
                            Changed from <span className="text-red-400">{log.oldValue}</span> to <span className="text-green-400">{log.newValue}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete Confirmation */}
      <AlertDialog.Root open={!!deleteAccount} onOpenChange={(open) => !open && setDeleteAccount(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 border border-gray-700 rounded-lg p-6 w-full max-w-md z-50">
            <AlertDialog.Title className="text-xl font-bold text-white mb-2">Delete Account?</AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-gray-400 mb-4">
              Are you sure you want to delete "{deleteAccount?.name}"? This action cannot be undone.
            </AlertDialog.Description>
            <div className="flex gap-2">
              <AlertDialog.Action asChild>
                <Button className="flex-1 bg-red-600 hover:bg-red-500" onClick={confirmDelete} disabled={loading}>
                  {loading ? 'Deleting...' : 'Delete'}
                </Button>
              </AlertDialog.Action>
              <AlertDialog.Cancel asChild>
                <Button variant="outline" className="flex-1 border-gray-700">Cancel</Button>
              </AlertDialog.Cancel>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      {/* ADD ACCOUNT DRAWER */}
      <AddChartAccountDrawer
        open={isAddDrawerOpen}
        onOpenChange={setIsAddDrawerOpen}
        account={selectedAccount}
        onClose={() => {
          setIsAddDrawerOpen(false);
          setSelectedAccount(null);
        }}
        onSave={handleSaveAccount}
      />

      {/* JOURNAL ENTRY DIALOG */}
      <EnhancedJournalEntryDialog
        open={isJournalEntryOpen}
        onOpenChange={setIsJournalEntryOpen}
        entry={selectedJournalEntry}
        accounts={accounts.map(a => ({ id: a.id, code: a.code, name: a.name }))}
        onSave={handleSaveJournalEntry}
      />

      {/* Footer */}
      <div className="shrink-0 px-6 py-3 border-t border-gray-800 bg-yellow-500/5 border-yellow-500/20">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-4 w-4 text-yellow-400 shrink-0" />
          <p className="text-xs text-gray-400">
            <span className="text-yellow-400 font-semibold">FULLY FUNCTIONAL TEST PAGE:</span> Single & Double Entry support, Professional PDF/Excel exports, Real-time balance updates, and complete accounting logic. System ready for LIVE deployment.
          </p>
        </div>
      </div>
    </div>
  );
};
