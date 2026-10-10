/**
 * Phase 3B — role gate for Cash Flow unified preview toggle.
 * Read-only — does not write feature_flags.
 */

import { canAccessAccountingDeveloperCenter } from '@/app/lib/accountingDeveloperCenterAccess';
import { canAccessDeveloperIntegrityLab } from '@/app/lib/developerAccountingAccess';

export function canAccessCashFlowUnifiedPreview(userRole: string | null | undefined): boolean {
  return canAccessAccountingDeveloperCenter(userRole) || canAccessDeveloperIntegrityLab(userRole);
}
