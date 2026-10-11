/**
 * COA auto-seed + parent repair — same structure as web defaultAccountsService.
 */
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  CANONICAL_LEAF_CODES,
  COA_PARENT_GROUP_CODES,
  resolveCanonicalParentId,
  type OperationalLedgerRole,
} from '../lib/accountHierarchy';
import type { AccountRow } from './accounts';
import { getAccounts } from './accounts';

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
  { code: '4120', name: 'Extra Service Income', type: 'revenue', parentCode: '4050' },
  { code: '4200', name: 'Rental Income', type: 'revenue', parentCode: '4050' },
  { code: '5000', name: 'Cost of Production', type: 'expense', parentCode: '6090' },
  { code: '5010', name: 'COGS - Inventory', type: 'expense', parentCode: '6090' },
  { code: '5100', name: 'Shipping Expense', type: 'expense', parentCode: '6090' },
  { code: '5110', name: 'Sales Commission Expense', type: 'expense', parentCode: '6090' },
  { code: '5200', name: 'Discount Allowed', type: 'expense', parentCode: '6090' },
  { code: '5300', name: 'Rental Expense', type: 'expense', parentCode: '6090' },
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
  { code: '4120', parentCode: '4050' },
  { code: '4200', parentCode: '4050' },
  { code: '5000', parentCode: '6090' },
  { code: '5010', parentCode: '6090' },
  { code: '5100', parentCode: '6090' },
  { code: '5110', parentCode: '6090' },
  { code: '5200', parentCode: '6090' },
  { code: '2040', parentCode: '2090' },
  { code: '6100', parentCode: '6090' },
  { code: '6110', parentCode: '6090' },
  { code: '6120', parentCode: '6090' },
];

function trimCode(a: { code?: string | null }): string {
  return String(a.code || '').trim();
}

function findByCode(list: AccountRow[], code: string): AccountRow | undefined {
  return list.find((a) => trimCode(a) === code);
}

async function insertSeedRow(companyId: string, row: SeedDef, list: AccountRow[]): Promise<void> {
  const parentId = row.parentCode ? findByCode(list, row.parentCode)?.id : undefined;
  if (row.parentCode && !parentId) return;
  const payload: Record<string, unknown> = {
    company_id: companyId,
    code: row.code,
    name: row.name,
    type: row.type,
    balance: 0,
    is_active: true,
  };
  if (parentId) payload.parent_id = parentId;
  if (row.is_group !== undefined) payload.is_group = row.is_group;
  const { error } = await supabase.from('accounts').insert(payload);
  if (error) console.warn(`[DEFAULT ACCOUNTS] insert ${row.code}:`, error.message);
}

/** Link orphan cash/bank/wallet/receivable/payable rows created without parent_id (mobile legacy). */
async function repairOrphanOperationalParents(companyId: string): Promise<void> {
  let { data: list } = await getAccounts(companyId);
  if (!list?.length) return;
  const headerCodes = new Set<string>([
    CANONICAL_LEAF_CODES.cash,
    CANONICAL_LEAF_CODES.bank,
    CANONICAL_LEAF_CODES.mobile_wallet,
    COA_PARENT_GROUP_CODES.cash,
    COA_PARENT_GROUP_CODES.bank,
    COA_PARENT_GROUP_CODES.mobile_wallet,
  ]);
  const roleByType: Record<string, OperationalLedgerRole> = {
    cash: 'cash',
    bank: 'bank',
    mobile_wallet: 'mobile_wallet',
    wallet: 'mobile_wallet',
    receivable: 'receivable',
    payable: 'payable',
  };
  for (const child of list) {
    if (child.parentId || child.isGroup || child.linkedContactId) continue;
    const code = String(child.code || '').trim();
    if (headerCodes.has(code)) continue;
    const role = roleByType[(child.type || '').toLowerCase()];
    if (!role) continue;
    const hierarchy = list.map((a) => ({
      id: a.id,
      code: a.code,
      parent_id: a.parentId ?? null,
    }));
    const parentId = resolveCanonicalParentId(hierarchy, role);
    if (!parentId || child.parentId === parentId) continue;
    const { error } = await supabase.from('accounts').update({ parent_id: parentId }).eq('id', child.id);
    if (!error) {
      const refreshed = await getAccounts(companyId);
      list = refreshed.data || list;
    }
  }
}

async function repairParents(companyId: string): Promise<void> {
  let { data: list } = await getAccounts(companyId);
  if (!list) return;
  for (const { code, parentCode } of REPAIR_PARENT_BY_CODE) {
    const child = findByCode(list, code);
    const parent = findByCode(list, parentCode);
    if (!child?.id || !parent?.id || child.parentId === parent.id) continue;
    const { error } = await supabase.from('accounts').update({ parent_id: parent.id }).eq('id', child.id);
    if (error) console.warn(`[DEFAULT ACCOUNTS] repair ${code}:`, error.message);
    else {
      const refreshed = await getAccounts(companyId);
      list = refreshed.data || list;
    }
  }
}

function shouldSkipSalesRevenueSeed(list: AccountRow[]): boolean {
  return !!(findByCode(list, '4000') || findByCode(list, '4100'));
}

/** Ensures COA groups + core leaves and repairs parent_id for known codes (idempotent). */
export async function ensureDefaultAccounts(companyId: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  try {
    let { data: list, error } = await getAccounts(companyId);
    if (error) return { error };
    list = list || [];

    for (const g of GROUP_ROWS) {
      if (findByCode(list, g.code)) continue;
      await insertSeedRow(companyId, g, list);
      const r = await getAccounts(companyId);
      list = r.data || list;
    }

    for (const row of LEAF_ROWS) {
      if (row.code === '4100' && shouldSkipSalesRevenueSeed(list)) continue;
      if (findByCode(list, row.code)) continue;
      await insertSeedRow(companyId, row, list);
      const r = await getAccounts(companyId);
      list = r.data || list;
    }

    await repairParents(companyId);
    await repairOrphanOperationalParents(companyId);
    return { error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to ensure default accounts';
    return { error: msg };
  }
}
