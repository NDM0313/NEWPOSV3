/**
 * Chart hierarchy audit (read-only). Does not mutate data.
 * Call from admin tools or Integrity Lab; GL truth remains journals.
 */

import { accountService } from '@/app/services/accountService';
import { auditAccountHierarchy, type AccountRow } from '@/app/lib/accountHierarchy';

export async function runAccountHierarchyAudit(companyId: string) {
  const raw = await accountService.getAllAccounts(companyId);
  const rows: AccountRow[] = (raw || []).map((a: any) => ({
    id: a.id,
    company_id: a.company_id,
    code: a.code,
    name: a.name,
    type: a.type,
    parent_id: a.parent_id,
    is_active: a.is_active,
    is_group: a.is_group,
  }));
  const issues = auditAccountHierarchy(rows);
  return {
    companyId,
    scannedAccounts: rows.length,
    issueCount: issues.length,
    issues,
  };
}
