export type LegacyReportKey =
  | 'customer-ledger'
  | 'supplier-ledger'
  | 'worker-ledger'
  | 'account-ledger'
  | 'daybook'
  | 'cash-summary'
  | 'bank-summary'
  | 'wallet-summary'
  | 'payables'
  | 'receivables'
  | 'balance-sheet'
  | 'profit-loss'
  | 'trial-balance'
  | 'cash-flow'
  | 'ledger-v2'
  | 'sales-report'
  | 'studio-sales'
  | 'purchase-report'
  | 'expense-report'
  | 'studio-report'
  | 'rental-report'
  | 'inventory-report'
  | 'courier-shipments';

export type ReportHubMode = 'easy' | 'standard' | 'advanced';

export type ReportHubSection =
  | 'party-ledgers'
  | 'financial-statements'
  | 'cash-bank'
  | 'receivables-payables'
  | 'operations';

export type ReportIconKey =
  | 'users'
  | 'briefcase'
  | 'book-open'
  | 'scale'
  | 'trending-up'
  | 'bar-chart'
  | 'wallet'
  | 'layers'
  | 'landmark'
  | 'smartphone'
  | 'calendar-clock'
  | 'arrow-down-left'
  | 'arrow-up-right'
  | 'receipt'
  | 'shopping-cart'
  | 'trending-down'
  | 'palette'
  | 'shirt'
  | 'package'
  | 'truck';

export interface ReportCatalogEntry {
  key: LegacyReportKey;
  tier: ReportHubMode;
  section: ReportHubSection;
  title: string;
  description: string;
  gradient: string;
  icon: ReportIconKey;
  requiresFullAccounting?: boolean;
  requiresCustomerLedger?: boolean;
  requiresSupplierLedger?: boolean;
}

export const REPORT_HUB_MODE_STORAGE_KEY = 'erp-mobile-reports-hub-mode';

const MODE_RANK: Record<ReportHubMode, number> = {
  easy: 1,
  standard: 2,
  advanced: 3,
};

export const REPORT_SECTION_LABELS: Record<ReportHubSection, string> = {
  'party-ledgers': 'Party ledgers',
  'financial-statements': 'Financial statements',
  'cash-bank': 'Cash & bank',
  'receivables-payables': 'Receivables & payables',
  operations: 'Operations',
};

/** Cumulative tiers: easy ⊂ standard ⊂ advanced */
export const REPORT_CATALOG: ReportCatalogEntry[] = [
  {
    key: 'daybook',
    tier: 'easy',
    section: 'cash-bank',
    title: 'Day Book / Roznamcha',
    description: 'Daily cash-in / cash-out',
    gradient: 'from-[#3B82F6] to-[#2563EB]',
    icon: 'calendar-clock',
    requiresFullAccounting: true,
  },
  {
    key: 'customer-ledger',
    tier: 'easy',
    section: 'party-ledgers',
    title: 'Customer Ledger',
    description: 'Per-customer AR statement',
    gradient: 'from-[#6366F1] to-[#4F46E5]',
    icon: 'users',
    requiresCustomerLedger: true,
  },
  {
    key: 'cash-summary',
    tier: 'easy',
    section: 'cash-bank',
    title: 'Cash Summary',
    description: 'Cash account movements',
    gradient: 'from-[#10B981] to-[#059669]',
    icon: 'wallet',
    requiresFullAccounting: true,
  },
  {
    key: 'bank-summary',
    tier: 'easy',
    section: 'cash-bank',
    title: 'Bank Summary',
    description: 'Bank account activity',
    gradient: 'from-[#0EA5E9] to-[#0284C7]',
    icon: 'landmark',
    requiresFullAccounting: true,
  },
  {
    key: 'sales-report',
    tier: 'easy',
    section: 'operations',
    title: 'Sales Report',
    description: 'Invoice & revenue activity',
    gradient: 'from-[#6366F1] to-[#4F46E5]',
    icon: 'receipt',
    requiresFullAccounting: true,
  },
  {
    key: 'receivables',
    tier: 'easy',
    section: 'receivables-payables',
    title: 'Receivables',
    description: 'Customer outstanding + aging',
    gradient: 'from-[#EC4899] to-[#DB2777]',
    icon: 'arrow-down-left',
    requiresCustomerLedger: true,
  },
  {
    key: 'supplier-ledger',
    tier: 'standard',
    section: 'party-ledgers',
    title: 'Supplier Ledger',
    description: 'Per-supplier AP statement',
    gradient: 'from-[#F59E0B] to-[#D97706]',
    icon: 'briefcase',
    requiresSupplierLedger: true,
  },
  {
    key: 'worker-ledger',
    tier: 'standard',
    section: 'party-ledgers',
    title: 'Worker Ledger',
    description: 'Payables to workers',
    gradient: 'from-[#10B981] to-[#059669]',
    icon: 'users',
    requiresFullAccounting: true,
  },
  {
    key: 'account-ledger',
    tier: 'standard',
    section: 'party-ledgers',
    title: 'Account Ledger',
    description: 'Running balance per GL',
    gradient: 'from-[#8B5CF6] to-[#6366F1]',
    icon: 'book-open',
    requiresFullAccounting: true,
  },
  {
    key: 'wallet-summary',
    tier: 'standard',
    section: 'cash-bank',
    title: 'Wallet Summary',
    description: 'Mobile wallets',
    gradient: 'from-[#F97316] to-[#C2410C]',
    icon: 'smartphone',
    requiresFullAccounting: true,
  },
  {
    key: 'payables',
    tier: 'standard',
    section: 'receivables-payables',
    title: 'Payables',
    description: 'Supplier dues + aging',
    gradient: 'from-[#F59E0B] to-[#D97706]',
    icon: 'arrow-up-right',
    requiresSupplierLedger: true,
  },
  {
    key: 'purchase-report',
    tier: 'standard',
    section: 'operations',
    title: 'Purchase Report',
    description: 'Purchase orders / GRNs',
    gradient: 'from-[#F59E0B] to-[#D97706]',
    icon: 'shopping-cart',
    requiresFullAccounting: true,
  },
  {
    key: 'expense-report',
    tier: 'standard',
    section: 'operations',
    title: 'Expense Report',
    description: 'Expenses by category',
    gradient: 'from-[#F43F5E] to-[#E11D48]',
    icon: 'trending-down',
    requiresFullAccounting: true,
  },
  {
    key: 'balance-sheet',
    tier: 'standard',
    section: 'financial-statements',
    title: 'Balance Sheet',
    description: 'Assets, liabilities & equity',
    gradient: 'from-[#6366F1] to-[#4F46E5]',
    icon: 'scale',
    requiresFullAccounting: true,
  },
  {
    key: 'profit-loss',
    tier: 'standard',
    section: 'financial-statements',
    title: 'Profit & Loss',
    description: 'Revenue, costs & net profit',
    gradient: 'from-[#10B981] to-[#059669]',
    icon: 'trending-up',
    requiresFullAccounting: true,
  },
  {
    key: 'trial-balance',
    tier: 'advanced',
    section: 'financial-statements',
    title: 'Trial Balance',
    description: 'Account balances with debit & credit breakdown',
    gradient: 'from-[#8B5CF6] to-[#6366F1]',
    icon: 'bar-chart',
    requiresFullAccounting: true,
  },
  {
    key: 'cash-flow',
    tier: 'advanced',
    section: 'financial-statements',
    title: 'Cash Flow',
    description: 'Cash & bank movements',
    gradient: 'from-[#0EA5E9] to-[#0284C7]',
    icon: 'wallet',
    requiresFullAccounting: true,
  },
  {
    key: 'ledger-v2',
    tier: 'advanced',
    section: 'financial-statements',
    title: 'Ledger V2',
    description: 'Unified GL account ledger',
    gradient: 'from-[#475569] to-[#1E293B]',
    icon: 'layers',
    requiresFullAccounting: true,
  },
  {
    key: 'studio-report',
    tier: 'advanced',
    section: 'operations',
    title: 'Studio Report',
    description: 'Custom productions',
    gradient: 'from-[#8B5CF6] to-[#7C3AED]',
    icon: 'palette',
    requiresFullAccounting: true,
  },
  {
    key: 'rental-report',
    tier: 'advanced',
    section: 'operations',
    title: 'Rental Report',
    description: 'Rental bookings',
    gradient: 'from-[#F97316] to-[#C2410C]',
    icon: 'shirt',
    requiresFullAccounting: true,
  },
  {
    key: 'inventory-report',
    tier: 'advanced',
    section: 'operations',
    title: 'Inventory Report',
    description: 'Stock movements (in / out)',
    gradient: 'from-[#475569] to-[#1E293B]',
    icon: 'package',
    requiresFullAccounting: true,
  },
  {
    key: 'courier-shipments',
    tier: 'advanced',
    section: 'operations',
    title: 'Courier Shipments',
    description: 'Cargo bookings & tracking',
    gradient: 'from-[#0EA5E9] to-[#0284C7]',
    icon: 'truck',
    requiresFullAccounting: true,
  },
];

export interface ReportHubPermissions {
  fullAccounting: boolean;
  canViewCustomerLedger: boolean;
  canViewSupplierLedger: boolean;
}

export function normalizeReportHubMode(value: string | null | undefined): ReportHubMode {
  if (value === 'standard' || value === 'advanced') return value;
  return 'easy';
}

export function loadStoredReportHubMode(): ReportHubMode {
  try {
    return normalizeReportHubMode(localStorage.getItem(REPORT_HUB_MODE_STORAGE_KEY));
  } catch {
    return 'easy';
  }
}

export function saveReportHubMode(mode: ReportHubMode): void {
  try {
    localStorage.setItem(REPORT_HUB_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore storage failures
  }
}

export function modeIncludesTier(mode: ReportHubMode, tier: ReportHubMode): boolean {
  return MODE_RANK[mode] >= MODE_RANK[tier];
}

export function isReportAllowedByPermissions(
  entry: ReportCatalogEntry,
  permissions: ReportHubPermissions,
): boolean {
  if (entry.requiresFullAccounting && !permissions.fullAccounting) return false;
  if (entry.requiresCustomerLedger && !permissions.canViewCustomerLedger) return false;
  if (entry.requiresSupplierLedger && !permissions.canViewSupplierLedger) return false;
  return true;
}

export function reportsVisibleInMode(
  mode: ReportHubMode,
  permissions: ReportHubPermissions,
): ReportCatalogEntry[] {
  return REPORT_CATALOG.filter(
    (entry) => modeIncludesTier(mode, entry.tier) && isReportAllowedByPermissions(entry, permissions),
  );
}

export function modeIncludesReport(mode: ReportHubMode, key: LegacyReportKey): boolean {
  const entry = REPORT_CATALOG.find((item) => item.key === key);
  if (!entry) return true;
  return modeIncludesTier(mode, entry.tier);
}

export function reportsBySection(
  mode: ReportHubMode,
  permissions: ReportHubPermissions,
): Partial<Record<ReportHubSection, ReportCatalogEntry[]>> {
  const grouped: Partial<Record<ReportHubSection, ReportCatalogEntry[]>> = {};
  for (const entry of reportsVisibleInMode(mode, permissions)) {
    if (!grouped[entry.section]) grouped[entry.section] = [];
    grouped[entry.section]!.push(entry);
  }
  return grouped;
}
