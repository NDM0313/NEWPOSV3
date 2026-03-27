/**
 * Canonical chart hierarchy: parent_id, UI tree, BS classification.
 * GL truth remains journal-derived; never use accounts.balance for reporting truth.
 */

export { COA_HEADER_CODES, COA_HEADER_CODE_LIST } from '@/app/data/defaultCoASeed';

/** Canonical control / default leaf codes (posting). */
export const CANONICAL_LEAF_CODES = {
  cash: '1000',
  bank: '1010',
  mobile_wallet: '1020',
  petty_cash: '1001',
  ar: '1100',
  worker_advance: '1180',
  ap: '2000',
  worker_payable: '2010',
  owner_capital: '3000',
} as const;

/** Immediate parent group for new operational / liquidity children (preferred). */
export const COA_PARENT_GROUP_CODES = {
  cash: '1050',
  bank: '1060',
  mobile_wallet: '1070',
  ar: '1100',
  ap: '2000',
} as const;

/** @deprecated use COA_PARENT_GROUP_CODES + CANONICAL_LEAF_CODES */
export const CANONICAL_GROUP_CODES = {
  cash: CANONICAL_LEAF_CODES.cash,
  bank: CANONICAL_LEAF_CODES.bank,
  mobile_wallet: CANONICAL_LEAF_CODES.mobile_wallet,
  ar: COA_PARENT_GROUP_CODES.ar,
  worker_advance: CANONICAL_LEAF_CODES.worker_advance,
  ap: CANONICAL_LEAF_CODES.ap,
  worker_payable: CANONICAL_LEAF_CODES.worker_payable,
  owner_capital: CANONICAL_LEAF_CODES.owner_capital,
} as const;

export type OperationalLedgerRole =
  | 'cash'
  | 'bank'
  | 'mobile_wallet'
  | 'expense'
  | 'income'
  | 'receivable'
  | 'payable';

export interface AccountRow {
  id: string;
  company_id?: string;
  code?: string | null;
  name?: string | null;
  type?: string | null;
  parent_id?: string | null;
  is_active?: boolean | null;
  is_group?: boolean | null;
}

export function accountByCode(accounts: AccountRow[], code: string): AccountRow | undefined {
  const c = code.trim();
  return accounts.find((a) => String(a.code || '').trim() === c);
}

/**
 * Default parent for operational roles: prefer section group (1050/1060/1070), else legacy header leaf (1000/1010/1020).
 */
export function resolveCanonicalParentId(
  accounts: AccountRow[],
  role: OperationalLedgerRole
): string | null {
  const map: Record<OperationalLedgerRole, { group: string | null; legacyLeaf: string | null }> = {
    cash: { group: COA_PARENT_GROUP_CODES.cash, legacyLeaf: CANONICAL_LEAF_CODES.cash },
    bank: { group: COA_PARENT_GROUP_CODES.bank, legacyLeaf: CANONICAL_LEAF_CODES.bank },
    mobile_wallet: { group: COA_PARENT_GROUP_CODES.mobile_wallet, legacyLeaf: CANONICAL_LEAF_CODES.mobile_wallet },
    receivable: { group: COA_PARENT_GROUP_CODES.ar, legacyLeaf: COA_PARENT_GROUP_CODES.ar },
    payable: { group: COA_PARENT_GROUP_CODES.ap, legacyLeaf: COA_PARENT_GROUP_CODES.ap },
    expense: { group: null, legacyLeaf: null },
    income: { group: null, legacyLeaf: null },
  };
  const { group, legacyLeaf } = map[role];
  if (!group && !legacyLeaf) return null;
  const gid = group ? accountByCode(accounts, group)?.id : null;
  if (gid) return gid;
  const lid = legacyLeaf ? accountByCode(accounts, legacyLeaf)?.id : null;
  return lid ?? null;
}

export function buildAccountMapById(accounts: AccountRow[]): Map<string, AccountRow> {
  const m = new Map<string, AccountRow>();
  accounts.forEach((a) => {
    if (a.id) m.set(a.id, a);
  });
  return m;
}

/** Walk parent chain; return first matching predicate or null. */
export function findAncestor(
  startId: string | null | undefined,
  byId: Map<string, AccountRow>,
  match: (a: AccountRow) => boolean,
  maxDepth = 24
): AccountRow | null {
  let cur = startId ? byId.get(startId) : undefined;
  const seen = new Set<string>();
  for (let i = 0; i < maxDepth && cur; i++) {
    if (match(cur)) return cur;
    const pid = cur.parent_id;
    if (!pid || seen.has(pid)) break;
    seen.add(pid);
    cur = byId.get(pid);
  }
  return null;
}

export type CoaStatementSection = 'assets' | 'liabilities' | 'equity' | 'income' | 'expense' | 'other';

const SECTION_ORDER: Record<CoaStatementSection, number> = {
  assets: 0,
  liabilities: 1,
  equity: 2,
  income: 3,
  expense: 4,
  other: 5,
};

export const COA_SECTION_LABEL: Record<CoaStatementSection, string> = {
  assets: 'Assets',
  liabilities: 'Liabilities',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expenses',
  other: 'Other',
};

export function coaStatementSection(account: Pick<AccountRow, 'type' | 'code'>): CoaStatementSection {
  const t = String(account.type || '').toLowerCase();
  if (['asset', 'cash', 'bank', 'mobile_wallet', 'receivable', 'inventory'].some((x) => t.includes(x))) return 'assets';
  if (['liability', 'payable'].some((x) => t.includes(x))) return 'liabilities';
  if (t.includes('equity')) return 'equity';
  if (t.includes('revenue') || t.includes('income')) return 'income';
  if (t.includes('expense') || t.includes('cogs') || t.includes('cost of sales')) return 'expense';
  return 'other';
}

export function compareCoaSection(a: CoaStatementSection, b: CoaStatementSection): number {
  return SECTION_ORDER[a] - SECTION_ORDER[b];
}

export type BalanceSheetAssetGroup = 'cash_bank' | 'inventory' | 'receivables' | 'advances' | 'other';

const CASH_CLUSTER = new Set(['1000', '1010', '1020', '1050', '1060', '1070']);

/**
 * Classify an asset line for Balance Sheet grouping (TB amounts computed elsewhere).
 * Priority: DB type → parent chain to liquidity / AR / advance groups → code → minimal name fallback for generic asset.
 */
export function classifyBalanceSheetAsset(
  account: Pick<AccountRow, 'code' | 'name' | 'type' | 'parent_id'>,
  byId: Map<string, AccountRow>
): BalanceSheetAssetGroup {
  const t = String(account.type || '').toLowerCase();
  const c0 = String(account.code || '').trim();
  if (t === 'inventory' || c0 === '1200') return 'inventory';

  const invHdr = findAncestor(account.parent_id, byId, (a) => String(a.code || '').trim() === '1090');
  if (invHdr) return 'inventory';

  if (t === 'cash' || t === 'bank' || t === 'mobile_wallet') return 'cash_bank';

  const cashHdr = findAncestor(account.parent_id, byId, (a) => CASH_CLUSTER.has(String(a.code || '').trim()));
  if (cashHdr) return 'cash_bank';

  const arHdr = findAncestor(
    account.parent_id,
    byId,
    (a) => String(a.code || '').trim() === CANONICAL_LEAF_CODES.ar
  );
  if (arHdr || String(account.code || '').trim() === CANONICAL_LEAF_CODES.ar || t === 'receivable') {
    return 'receivables';
  }

  const advHdr = findAncestor(
    account.parent_id,
    byId,
    (a) => String(a.code || '').trim() === '1080' || String(a.code || '').trim() === CANONICAL_LEAF_CODES.worker_advance
  );
  if (advHdr || String(account.code || '').trim() === CANONICAL_LEAF_CODES.worker_advance) {
    return 'advances';
  }

  const c = String(account.code || '').trim();
  const n = (account.name || '').toLowerCase();
  if (t === 'asset') {
    if (n.includes('inventory') || n.includes('stock') || c === '1200' || c === '1300') return 'inventory';
    if (n.includes('receivable')) return 'receivables';
    if (n.includes('advance') && n.includes('worker')) return 'advances';
  }

  return 'other';
}

export type BalanceSheetLiabilityGroup = 'trade_payables' | 'payroll_related' | 'deposits_and_advances' | 'courier' | 'other';

export function classifyBalanceSheetLiability(
  account: Pick<AccountRow, 'code' | 'name' | 'type' | 'parent_id'>,
  byId: Map<string, AccountRow>
): BalanceSheetLiabilityGroup {
  const code = String(account.code || '').trim();
  const t = String(account.type || '').toLowerCase();
  if (code === '2030' || findAncestor(account.parent_id, byId, (a) => String(a.code || '').trim() === '2030')) {
    return 'courier';
  }
  if (
    code === CANONICAL_LEAF_CODES.worker_payable ||
    (t.includes('liability') && (account.name || '').toLowerCase().includes('worker payable'))
  ) {
    return 'payroll_related';
  }
  if (code === '2011' || code === '2020') return 'deposits_and_advances';
  if (
    code === CANONICAL_LEAF_CODES.ap ||
    t === 'payable' ||
    findAncestor(account.parent_id, byId, (a) => String(a.code || '').trim() === '2090')
  ) {
    return 'trade_payables';
  }
  return 'other';
}

export type HierarchyAuditIssue = {
  severity: 'warn' | 'error';
  code: string;
  message: string;
  accountId?: string;
  accountCode?: string;
  accountName?: string;
};

function liquidityParentOk(parentCode: string, childType: string): boolean {
  if (childType === 'cash') return parentCode === COA_PARENT_GROUP_CODES.cash || parentCode === CANONICAL_LEAF_CODES.cash;
  if (childType === 'bank') return parentCode === COA_PARENT_GROUP_CODES.bank || parentCode === CANONICAL_LEAF_CODES.bank;
  if (childType === 'mobile_wallet')
    return parentCode === COA_PARENT_GROUP_CODES.mobile_wallet || parentCode === CANONICAL_LEAF_CODES.mobile_wallet;
  return false;
}

/** Read-only hierarchy checks for liquidity, AR, AP children. */
export function auditAccountHierarchy(accounts: AccountRow[]): HierarchyAuditIssue[] {
  const issues: HierarchyAuditIssue[] = [];
  const byId = buildAccountMapById(accounts);

  for (const a of accounts) {
    if (a.is_active === false) continue;
    const id = a.id;
    const code = String(a.code || '').trim();
    const t = String(a.type || '').toLowerCase();
    const name = String(a.name || '');
    const parent = a.parent_id ? byId.get(a.parent_id) : undefined;
    const parentCode = parent ? String(parent.code || '').trim() : '';

    if (['cash', 'bank', 'mobile_wallet'].includes(t)) {
      if (['1000', '1010', '1020'].includes(code)) {
        const want =
          code === '1000'
            ? COA_PARENT_GROUP_CODES.cash
            : code === '1010'
              ? COA_PARENT_GROUP_CODES.bank
              : COA_PARENT_GROUP_CODES.mobile_wallet;
        const groupRow = accountByCode(accounts, want);
        if (groupRow && parentCode !== want) {
          issues.push({
            severity: 'warn',
            code: 'DEFAULT_LIQUIDITY_PARENT',
            message: `Default ${t} account (${code}) should be a direct child of group ${want} (got parent ${parentCode || 'none'}).`,
            accountId: id,
            accountCode: code,
            accountName: name,
          });
        }
      } else if (!liquidityParentOk(parentCode, t)) {
        issues.push({
          severity: 'warn',
          code: 'LIQUIDITY_CHILD_PARENT',
          message: `Account type "${t}" should sit under liquidity group ${COA_PARENT_GROUP_CODES[t as 'cash' | 'bank' | 'mobile_wallet']} or legacy header ${CANONICAL_LEAF_CODES[t as 'cash' | 'bank' | 'mobile_wallet']}.`,
          accountId: id,
          accountCode: code,
          accountName: name,
        });
      }
    }

    if (t === 'receivable' && code !== CANONICAL_LEAF_CODES.ar) {
      if (String(parent?.code || '').trim() !== CANONICAL_LEAF_CODES.ar) {
        issues.push({
          severity: 'warn',
          code: 'AR_CHILD_PARENT',
          message: `Receivable detail should be parent-linked to ${CANONICAL_LEAF_CODES.ar} (AR control).`,
          accountId: id,
          accountCode: code,
          accountName: name,
        });
      }
    }

    if ((t === 'payable' || t === 'liability') && name.toLowerCase().includes('worker') && code !== CANONICAL_LEAF_CODES.worker_payable) {
      if (
        String(parent?.code || '').trim() !== CANONICAL_LEAF_CODES.worker_payable &&
        code !== CANONICAL_LEAF_CODES.worker_payable
      ) {
        issues.push({
          severity: 'warn',
          code: 'WORKER_PAYABLE_PARENT',
          message: 'Worker-related payable may belong under Worker Payable (2010).',
          accountId: id,
          accountCode: code,
          accountName: name,
        });
      }
    }

    if (t === 'inventory' && code === '1200') {
      const g1090 = accountByCode(accounts, '1090');
      if (g1090?.id && parent?.id !== g1090.id) {
        issues.push({
          severity: 'warn',
          code: 'INVENTORY_PARENT_GROUP',
          message: `Default inventory (1200) should be a direct child of group 1090 (got parent ${parentCode || 'none'}).`,
          accountId: id,
          accountCode: code,
          accountName: name,
        });
      }
    }
  }

  return issues;
}
