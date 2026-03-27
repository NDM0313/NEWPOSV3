/**
 * Full Chart-of-Accounts audit (read-only). GL truth remains journals.
 * Composes hierarchy rules + structural checks (roots, orphans, parent/child section alignment).
 */

import { accountService } from '@/app/services/accountService';
import { runAccountHierarchyAudit } from '@/app/services/accountHierarchyAuditService';
import {
  buildAccountMapById,
  coaStatementSection,
  type AccountRow,
  type HierarchyAuditIssue,
} from '@/app/lib/accountHierarchy';
import { COA_HEADER_CODES, COA_HEADER_CODE_LIST } from '@/app/data/defaultCoASeed';

const ALLOWED_ROOT_CODES = new Set<string>([
  ...COA_HEADER_CODE_LIST,
  '1100',
  '1195',
]);

export type FullAccountingAuditIssue = HierarchyAuditIssue & {
  category: 'hierarchy' | 'structure' | 'classification';
};

export type FullAccountingAuditResult = {
  companyId: string;
  scannedAccounts: number;
  issueCount: number;
  issues: FullAccountingAuditIssue[];
  hierarchyIssueCount: number;
};

function rowFromRaw(a: any): AccountRow {
  return {
    id: a.id,
    company_id: a.company_id,
    code: a.code,
    name: a.name,
    type: a.type,
    parent_id: a.parent_id,
    is_active: a.is_active,
    is_group: a.is_group,
  };
}

export async function runFullAccountingAudit(companyId: string): Promise<FullAccountingAuditResult> {
  const hierarchyPack = await runAccountHierarchyAudit(companyId);
  const raw = await accountService.getAllAccounts(companyId);
  const rows: AccountRow[] = (raw || []).map(rowFromRaw);
  const byId = buildAccountMapById(rows);

  const issues: FullAccountingAuditIssue[] = hierarchyPack.issues.map((i) => ({
    ...i,
    category: 'hierarchy' as const,
  }));

  for (const a of rows) {
    if (a.is_active === false) continue;
    const code = String(a.code || '').trim();
    const isHeader = a.is_group === true || COA_HEADER_CODES.has(code);

    if (a.parent_id && !byId.has(a.parent_id)) {
      issues.push({
        severity: 'error',
        category: 'structure',
        code: 'ORPHAN_PARENT_REF',
        message: `parent_id points to missing account (${a.parent_id}).`,
        accountId: a.id,
        accountCode: code,
        accountName: String(a.name || ''),
      });
      continue;
    }

    if (!a.parent_id && !isHeader && code && !ALLOWED_ROOT_CODES.has(code)) {
      issues.push({
        severity: 'warn',
        category: 'structure',
        code: 'UNEXPECTED_ROOT_ACCOUNT',
        message:
          'Active posting account has no parent; expected under a COA group or allowed root (1100, 1195, section headers). Inventory (1200) should sit under group 1090.',
        accountId: a.id,
        accountCode: code,
        accountName: String(a.name || ''),
      });
    }

    const parent = a.parent_id ? byId.get(a.parent_id) : undefined;
    if (parent && !parent.is_group) {
      const cs = coaStatementSection(a);
      const ps = coaStatementSection(parent);
      if (cs !== 'other' && ps !== 'other' && cs !== ps) {
        issues.push({
          severity: 'warn',
          category: 'classification',
          code: 'PARENT_CHILD_SECTION_MISMATCH',
          message: `Child statement section "${cs}" differs from non-group parent section "${ps}" (types: ${parent.type} → ${a.type}).`,
          accountId: a.id,
          accountCode: code,
          accountName: String(a.name || ''),
        });
      }
    }
  }

  return {
    companyId,
    scannedAccounts: rows.length,
    issueCount: issues.length,
    issues,
    hierarchyIssueCount: hierarchyPack.issueCount,
  };
}
