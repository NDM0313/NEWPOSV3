/**
 * Phase 3A — role gate for Balance Sheet / P&L unified preview toggles.
 * Read-only — does not write feature_flags.
 */

import { canAccessAccountingDeveloperCenter } from '@/app/lib/accountingDeveloperCenterAccess';
import { canAccessDeveloperIntegrityLab } from '@/app/lib/developerAccountingAccess';

export function canAccessBsPlUnifiedPreview(userRole: string | null | undefined): boolean {
  return canAccessAccountingDeveloperCenter(userRole) || canAccessDeveloperIntegrityLab(userRole);
}
