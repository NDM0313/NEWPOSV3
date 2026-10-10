/**
 * Role gate for Roznamcha unified preview toggle (Phase 2.6).
 * Read-only — does not write feature_flags.
 */

import { canAccessAccountingDeveloperCenter } from '@/app/lib/accountingDeveloperCenterAccess';
import { canAccessDeveloperIntegrityLab } from '@/app/lib/developerAccountingAccess';

export function canAccessRoznamchaUnifiedPreview(userRole: string | null | undefined): boolean {
  return canAccessAccountingDeveloperCenter(userRole) || canAccessDeveloperIntegrityLab(userRole);
}
