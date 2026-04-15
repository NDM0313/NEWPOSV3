// ============================================
// 🎯 DEFAULT ACCOUNTS SERVICE — COA auto-seed + hierarchy repair
// ============================================

import { accountService } from './accountService';
import { COA_HEADER_CODE_LIST } from '@/app/data/defaultCoASeed';

export interface DefaultAccount {
  code: string;
  name: string;
  type: string;
}

type SeedDef = {
  code: string;
  name: string;
  type: string;
  parentCode: string | null;
  is_group?: boolean;
};

const GROUP_ROWS: SeedDef[] = [
  { code: '1050', name: 'Cash & Cash Equivalents', type: 'asset', parentCode: null, is_group: true },
  { code: '1060', name: 'Bank Accounts', type: 'asset', parentCode: null, is_group: true },
  { code: '1070', name: 'Mobile Wallets', type: 'asset', parentCode: null, is_group: true },
  { code: '1080', name: 'Worker Advances', type: 'asset', parentCode: null, is_group: true },
  { code: '1090', name: 'Inventory (group — post to 1200)', type: 'asset', parentCode: null, is_group: true },
  { code: '2090', name: 'Trade & Other Payables', type: 'liability', parentCode: null, is_group: true },
  { code: '3090', name: 'Equity', type: 'equity', parentCode: null, is_group: true },
  { code: '4050', name: 'Revenue', type: 'revenue', parentCode: null, is_group: true },
  { code: '6090', name: 'Operating Expenses', type: 'expense', parentCode: null, is_group: true },
];

/** Posting accounts (children). Order respects parent rows already in DB. */
const LEAF_ROWS: SeedDef[] = [
  { code: '1000', name: 'Cash', type: 'cash', parentCode: '1050' },
  { code: '1001', name: 'Petty Cash', type: 'cash', parentCode: '1050' },
  { code: '1010', name: 'Bank', type: 'bank', parentCode: '1060' },
  { code: '1020', name: 'Mobile Wallet', type: 'mobile_wallet', parentCode: '1070' },
  { code: '1100', name: 'Accounts Receivable', type: 'asset', parentCode: null },
  { code: '1200', name: 'Inventory', type: 'inventory', parentCode: '1090' },
  { code: '1180', name: 'Worker Advance', type: 'asset', parentCode: '1080' },
  { code: '2000', name: 'Accounts Payable', type: 'liability', parentCode: '2090' },
  { code: '2010', name: 'Worker Payable', type: 'liability', parentCode: '2090' },
  { code: '2011', name: 'Security Deposit', type: 'liability', parentCode: '2090' },
  { code: '2020', name: 'Rental Advance', type: 'liability', parentCode: '2090' },
  { code: '2030', name: 'Courier Payable (Control)', type: 'liability', parentCode: '2090' },
  { code: '3000', name: 'Owner Capital', type: 'equity', parentCode: '3090' },
  { code: '4100', name: 'Sales Revenue', type: 'revenue', parentCode: '4050' },
  { code: '4110', name: 'Shipping Income', type: 'revenue', parentCode: '4050' },
  { code: '4200', name: 'Rental Income', type: 'revenue', parentCode: '4050' },
  { code: '5000', name: 'Cost of Production', type: 'expense', parentCode: '6090' },
  { code: '5100', name: 'Shipping Expense', type: 'expense', parentCode: '6090' },
  { code: '5110', name: 'Sales Commission Expense', type: 'expense', parentCode: '6090' },
  { code: '5200', name: 'Discount Allowed', type: 'expense', parentCode: '6090' },
  { code: '2040', name: 'Salesman Payable', type: 'liability', parentCode: '2090' },
  { code: '6100', name: 'General operating expenses', type: 'expense', parentCode: '6090' },
  { code: '6110', name: 'Salary Expense', type: 'expense', parentCode: '6090' },
  { code: '6120', name: 'Marketing Expense', type: 'expense', parentCode: '6090' },
];

const REPAIR_PARENT_BY_CODE: { code: string; parentCode: string }[] = [
  { code: '1000', parentCode: '1050' },
  { code: '1001', parentCode: '1050' },
  { code: '1010', parentCode: '1060' },
  { code: '1020', parentCode: '1070' },
  { code: '1180', parentCode: '1080' },
  { code: '1200', parentCode: '1090' },
  { code: '2000', parentCode: '2090' },
  { code: '2010', parentCode: '2090' },
  { code: '2011', parentCode: '2090' },
  { code: '2020', parentCode: '2090' },
  { code: '2030', parentCode: '2090' },
  { code: '3000', parentCode: '3090' },
  { code: '3002', parentCode: '3090' },
  { code: '4000', parentCode: '4050' },
  { code: '4100', parentCode: '4050' },
  { code: '4110', parentCode: '4050' },
  { code: '4200', parentCode: '4050' },
  { code: '5000', parentCode: '6090' },
  { code: '5100', parentCode: '6090' },
  { code: '5110', parentCode: '6090' },
  { code: '5200', parentCode: '6090' },
  { code: '2040', parentCode: '2090' },
  { code: '6100', parentCode: '6090' },
  { code: '6110', parentCode: '6090' },
  { code: '6120', parentCode: '6090' },
];

const CORE_PAYMENT_CODES = new Set(['1000', '1010', '1020']);

const CORE_PAYMENT_ACCOUNTS: DefaultAccount[] = [
  { code: '1000', name: 'Cash', type: 'cash' },
  { code: '1010', name: 'Bank', type: 'bank' },
  { code: '1020', name: 'Mobile Wallet', type: 'mobile_wallet' },
];

const MANDATORY_ACCOUNTS: DefaultAccount[] = [
  ...CORE_PAYMENT_ACCOUNTS,
  ...GROUP_ROWS.map((g) => ({ code: g.code, name: g.name, type: g.type })),
  ...LEAF_ROWS.map((r) => ({ code: r.code, name: r.name, type: r.type })),
];

function trimCode(a: { code?: string | null }): string {
  return String(a.code || '').trim();
}

function findByCode(list: any[], code: string) {
  return list.find((a) => trimCode(a) === code);
}

async function insertAccountRow(
  companyId: string,
  row: SeedDef,
  list: any[]
): Promise<void> {
  const parentId = row.parentCode ? findByCode(list, row.parentCode)?.id : undefined;
  if (row.parentCode && !parentId) {
    console.warn(`[DEFAULT ACCOUNTS] Skip ${row.code}: parent ${row.parentCode} missing`);
    return;
  }
  await accountService.createAccount({
    company_id: companyId,
    code: row.code,
    name: row.name,
    type: row.type,
    balance: 0,
    is_active: true,
    parent_id: parentId ?? undefined,
    ...(row.is_group !== undefined ? { is_group: row.is_group } : {}),
  });
}

/** Rename legacy 6100 label so it is distinct from group 6090 "Operating Expenses". */
async function repairLegacyOperatingExpense6100Name(companyId: string): Promise<void> {
  const list = await accountService.getAllAccounts(companyId);
  const a = findByCode(list, '6100');
  if (!a?.id) return;
  const n = String(a.name || '').trim();
  if (n === 'Operating Expense') {
    try {
      await accountService.updateAccount(a.id, { name: 'General operating expenses' });
    } catch (e) {
      console.warn('[DEFAULT ACCOUNTS] rename 6100:', e);
    }
  }
}

async function repairParents(companyId: string): Promise<void> {
  let list = await accountService.getAllAccounts(companyId);
  for (const { code, parentCode } of REPAIR_PARENT_BY_CODE) {
    const child = findByCode(list, code);
    const parent = findByCode(list, parentCode);
    if (!child?.id || !parent?.id) continue;
    if (child.parent_id === parent.id) continue;
    try {
      await accountService.updateAccount(child.id, { parent_id: parent.id });
    } catch (e) {
      console.warn(`[DEFAULT ACCOUNTS] repair parent ${code} → ${parentCode}:`, e);
    }
    list = await accountService.getAllAccounts(companyId);
  }
}

/** Legacy 4000 Sales Revenue: keep single revenue anchor — do not duplicate 4100. */
function shouldSkipSalesRevenueSeed(list: any[]): boolean {
  return !!(findByCode(list, '4000') || findByCode(list, '4100'));
}

export const defaultAccountsService = {
  /**
   * Ensures full COA structure: section groups, core liquidity, AR/AP, equity, revenue, expenses.
   * Idempotent; repairs parent_id for known codes when groups exist.
   */
  async ensureDefaultAccounts(companyId: string): Promise<void> {
    try {
      let list = await accountService.getAllAccounts(companyId);

      for (const g of GROUP_ROWS) {
        if (findByCode(list, g.code)) continue;
        await insertAccountRow(companyId, g, list);
        list = await accountService.getAllAccounts(companyId);
      }

      for (const row of LEAF_ROWS) {
        if (row.code === '4100' && shouldSkipSalesRevenueSeed(list)) continue;
        if (findByCode(list, row.code)) continue;
        await insertAccountRow(companyId, row, list);
        list = await accountService.getAllAccounts(companyId);
      }

      await repairParents(companyId);
      await repairLegacyOperatingExpense6100Name(companyId);
      list = await accountService.getAllAccounts(companyId);

      for (const code of CORE_PAYMENT_CODES) {
        const ok = list.some((a) => trimCode(a) === code);
        if (!ok) {
          throw new Error(`Mandatory payment account ${code} missing after COA seed`);
        }
      }
    } catch (error: any) {
      console.error('[CORE ACCOUNTS] ❌ CRITICAL ERROR ensuring default accounts:', error);
      throw error;
    }
  },

  async getDefaultAccountByPaymentMethod(
    paymentMethod: string,
    companyId: string
  ): Promise<string | null> {
    try {
      const allAccounts = await accountService.getAllAccounts(companyId);
      const method = paymentMethod.toLowerCase();

      let targetCode: string | null = null;

      if (method === 'cash') {
        targetCode = '1000';
      } else if (method === 'bank' || method === 'card' || method === 'cheque') {
        targetCode = '1010';
      } else if (method === 'mobile_wallet' || method.includes('wallet')) {
        const walletAccount = allAccounts.find((acc) => trimCode(acc) === '1020');
        if (walletAccount) {
          return walletAccount.id;
        }
        targetCode = '1010';
      }

      if (targetCode) {
        const account = allAccounts.find((acc) => trimCode(acc) === targetCode);
        return account?.id || null;
      }

      return null;
    } catch (error: any) {
      console.error('[DEFAULT ACCOUNTS] Error getting default account:', error);
      return null;
    }
  },

  isCorePaymentAccount(account: { code?: string; name?: string; type?: string }): boolean {
    return CORE_PAYMENT_ACCOUNTS.some(
      (ca) =>
        ca.code === account.code ||
        (ca.name.toLowerCase() === (account.name || '').toLowerCase() &&
          (ca.type === String(account.type || '').toLowerCase() ||
            (ca.type === 'cash' &&
              String(account.type || '').toLowerCase() === 'asset' &&
              (account.name || '').toLowerCase().includes('cash')) ||
            (ca.type === 'bank' &&
              String(account.type || '').toLowerCase() === 'asset' &&
              (account.name || '').toLowerCase().includes('bank')) ||
            (ca.type === 'mobile_wallet' &&
              String(account.type || '').toLowerCase().includes('wallet'))))
    );
  },

  isMandatoryAccount(account: { code?: string; name?: string }): boolean {
    return MANDATORY_ACCOUNTS.some(
      (ma) =>
        ma.code === account.code || ma.name.toLowerCase() === (account.name || '').toLowerCase()
    );
  },

  getCorePaymentAccounts(): DefaultAccount[] {
    return [...CORE_PAYMENT_ACCOUNTS];
  },

  /** Header codes used for COA groups (payment pickers exclude these). */
  coaHeaderCodes(): readonly string[] {
    return [...COA_HEADER_CODE_LIST];
  },
};
