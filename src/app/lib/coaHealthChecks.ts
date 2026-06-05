/**
 * Pure COA health helpers (read-only). No DB writes.
 */

import { COA_CODES } from '@/app/config/coaMapping';
import { COA_HEADER_CODES } from '@/app/data/defaultCoASeed';
import type { FullAccountingAuditIssue } from '@/app/services/fullAccountingAuditService';

export type CoaHealthSeverity = 'error' | 'warning' | 'info';

export interface CoaAccountRow {
  id: string;
  code?: string | null;
  name?: string | null;
  type?: string | null;
  parent_id?: string | null;
  is_active?: boolean | null;
  is_group?: boolean | null;
  balance?: number | null;
}

export interface CoaHealthIssue {
  severity: CoaHealthSeverity;
  checkId: string;
  accountId?: string;
  accountCode?: string;
  accountName?: string;
  detail: string;
  lineCount?: number;
}

const SYSTEM_SEED_CODES = [
  COA_CODES.CASH,
  COA_CODES.BANK,
  COA_CODES.ACCOUNTS_RECEIVABLE,
  COA_CODES.INVENTORY,
  COA_CODES.ACCOUNTS_PAYABLE,
  COA_CODES.WORKER_PAYABLE,
  COA_CODES.CAPITAL,
  COA_CODES.SALES_REVENUE,
  COA_CODES.COGS,
] as const;

const CONTROL_CODES = new Set(['1100', '2000', '1000', '1010', '1020', '3000', '2010']);

function norm(s: string | null | undefined): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function findDuplicateCodes(accounts: CoaAccountRow[]): CoaHealthIssue[] {
  const byCode = new Map<string, CoaAccountRow[]>();
  for (const a of accounts) {
    const code = String(a.code || '').trim();
    if (!code) continue;
    const list = byCode.get(code) || [];
    list.push(a);
    byCode.set(code, list);
  }
  const out: CoaHealthIssue[] = [];
  for (const [code, rows] of byCode) {
    if (rows.length <= 1) continue;
    for (const a of rows) {
      out.push({
        severity: 'error',
        checkId: 'DUPLICATE_CODE',
        accountId: a.id,
        accountCode: code,
        accountName: String(a.name || ''),
        detail: `Code ${code} appears ${rows.length} times.`,
      });
    }
  }
  return out;
}

export function findDuplicateNamesUnderParent(accounts: CoaAccountRow[]): CoaHealthIssue[] {
  const byParentName = new Map<string, CoaAccountRow[]>();
  for (const a of accounts) {
    const key = `${a.parent_id || 'root'}|${norm(a.name)}`;
    if (!norm(a.name)) continue;
    const list = byParentName.get(key) || [];
    list.push(a);
    byParentName.set(key, list);
  }
  const out: CoaHealthIssue[] = [];
  for (const [, rows] of byParentName) {
    if (rows.length <= 1) continue;
    for (const a of rows) {
      out.push({
        severity: 'warning',
        checkId: 'DUPLICATE_NAME_UNDER_PARENT',
        accountId: a.id,
        accountCode: String(a.code || ''),
        accountName: String(a.name || ''),
        detail: `Duplicate name under same parent (${rows.length} accounts).`,
      });
    }
  }
  return out;
}

export function findMissingSystemAccounts(accounts: CoaAccountRow[]): CoaHealthIssue[] {
  const codes = new Set(accounts.map((a) => String(a.code || '').trim()).filter(Boolean));
  const out: CoaHealthIssue[] = [];
  for (const code of SYSTEM_SEED_CODES) {
    if (!codes.has(code)) {
      out.push({
        severity: 'warning',
        checkId: 'MISSING_SYSTEM_ACCOUNT',
        accountCode: code,
        detail: `Canonical seed account code ${code} is missing.`,
      });
    }
  }
  return out;
}

export function mapFullAuditIssues(issues: FullAccountingAuditIssue[]): CoaHealthIssue[] {
  return issues.map((i) => ({
    severity: i.severity === 'error' ? 'error' : i.severity === 'warn' ? 'warning' : 'info',
    checkId: i.code,
    accountId: i.accountId,
    accountCode: i.accountCode,
    accountName: i.accountName,
    detail: i.message,
  }));
}

export function classifyAccountEditSafety(
  account: CoaAccountRow,
  lineCount: number
): {
  canEditName: boolean;
  canArchive: boolean;
  cannotTouch: boolean;
  reason: string;
} {
  const code = String(account.code || '').trim();
  const isHeader = account.is_group === true || COA_HEADER_CODES.has(code);
  const isControl = CONTROL_CODES.has(code);

  if (isHeader || isControl) {
    return {
      canEditName: lineCount === 0,
      canArchive: false,
      cannotTouch: true,
      reason: isHeader ? 'COA section header (non-posting).' : 'System control account.',
    };
  }
  if (lineCount > 0) {
    return {
      canEditName: true,
      canArchive: false,
      cannotTouch: false,
      reason: 'Has journal lines — structural fields (code/type/parent) locked.',
    };
  }
  if (account.is_active === false) {
    return {
      canEditName: true,
      canArchive: true,
      cannotTouch: false,
      reason: 'Inactive with no journal lines — candidate for archive.',
    };
  }
  return {
    canEditName: true,
    canArchive: lineCount === 0,
    cannotTouch: false,
    reason: 'No journal lines — safe display edits only in Phase B (read-only).',
  };
}

export function isNonVoidJournalEntry(je: { is_void?: boolean | null } | null | undefined): boolean {
  return !!je && je.is_void !== true;
}

export interface JournalLineUsageInput {
  debit?: number | null;
  credit?: number | null;
  journalEntry?: {
    entry_date?: string | null;
    reference_type?: string | null;
    company_id?: string | null;
    is_void?: boolean | null;
  } | null;
}

export interface JournalLineUsageAggregate {
  lineCount: number;
  totalDebit: number;
  totalCredit: number;
  firstUsed: string | null;
  lastUsed: string | null;
  referenceTypes: string[];
}

/** Aggregate journal line usage; excludes voided entries and other companies. */
export function aggregateJournalLineUsage(
  lines: JournalLineUsageInput[],
  companyId: string
): JournalLineUsageAggregate {
  let totalDebit = 0;
  let totalCredit = 0;
  let firstUsed: string | null = null;
  let lastUsed: string | null = null;
  const refTypes = new Set<string>();
  let lineCount = 0;

  for (const row of lines) {
    const je = row.journalEntry;
    if (!je || je.company_id !== companyId) continue;
    if (!isNonVoidJournalEntry(je)) continue;
    lineCount += 1;
    totalDebit += Number(row.debit) || 0;
    totalCredit += Number(row.credit) || 0;
    const d = je.entry_date ? String(je.entry_date).slice(0, 10) : null;
    if (d) {
      if (!firstUsed || d < firstUsed) firstUsed = d;
      if (!lastUsed || d > lastUsed) lastUsed = d;
    }
    if (je.reference_type) refTypes.add(je.reference_type);
  }

  return {
    lineCount,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    firstUsed,
    lastUsed,
    referenceTypes: [...refTypes],
  };
}

export function inferModulesFromReferenceTypes(referenceTypes: string[]): string[] {
  const mods = new Set<string>();
  for (const rt of referenceTypes) {
    const t = rt.toLowerCase();
    if (t === 'sale' || t.includes('sale')) mods.add('Sales');
    else if (t === 'purchase' || t.includes('purchase')) mods.add('Purchase');
    else if (t === 'rental' || t.includes('rental')) mods.add('Rental');
    else if (t.includes('expense')) mods.add('Expenses');
    else if (t.includes('worker') || t.includes('studio')) mods.add('Studio');
    else if (t === 'payment' || t.includes('payment')) mods.add('Payments');
    else if (t.includes('opening_balance')) mods.add('Opening balance');
    else if (t === 'transfer') mods.add('Transfer');
    else if (t === 'journal' || t === 'manual_receipt' || t === 'manual_payment') mods.add('Manual GL');
    else mods.add('GL');
  }
  return [...mods].sort();
}
