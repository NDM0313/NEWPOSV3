/**
 * Role gate for Account Statement unified preview toggle (Phase 2.4).
 * Read-only — does not write feature_flags.
 */

import { canAccessAccountingDeveloperCenter } from '@/app/lib/accountingDeveloperCenterAccess';
import { canAccessDeveloperIntegrityLab } from '@/app/lib/developerAccountingAccess';

export function canAccessAccountStatementUnifiedPreview(userRole: string | null | undefined): boolean {
  return canAccessAccountingDeveloperCenter(userRole) || canAccessDeveloperIntegrityLab(userRole);
}
