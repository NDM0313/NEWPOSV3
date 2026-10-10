/**
 * Role gate for Ledger Statement V2 unified preview toggle (Phase 2.3).
 * Read-only — does not write feature_flags.
 */

import { canAccessAccountingDeveloperCenter } from '@/app/lib/accountingDeveloperCenterAccess';
import { canAccessDeveloperIntegrityLab } from '@/app/lib/developerAccountingAccess';

export function canAccessLedgerV2UnifiedPreview(userRole: string | null | undefined): boolean {
  return canAccessAccountingDeveloperCenter(userRole) || canAccessDeveloperIntegrityLab(userRole);
}
