/**
 * TEST ONLY — WIP Inventory layer stub.
 * Plan: MASTER_PROMPT_STUDIO_SAFETY.md STEP 7. Design: docs/WIP_INVENTORY_DESIGN.md
 * Do not use in production. When feature flag studio_wip_inventory_test is off, all functions no-op or return empty.
 */

import { FEATURE_KEYS, featureFlagsService } from './featureFlagsService';

export interface WipIssueRequest {
  productionId: string;
  productId: string;
  quantity: number;
  companyId: string;
  branchId?: string | null;
}

/**
 * TEST: Issue raw material to WIP for a production.
 * No-op when feature flag studio_wip_inventory_test is disabled.
 * When enabled (test DB only), would create WIP_ISSUE stock_movements or wip_balance rows.
 */
export async function issueRawToWipTest(
  _req: WipIssueRequest,
  companyId: string
): Promise<{ ok: boolean; message?: string }> {
  const enabled = await featureFlagsService.isEnabled(companyId, FEATURE_KEYS.STUDIO_WIP_INVENTORY_TEST);
  if (!enabled) return { ok: true, message: 'WIP inventory test disabled' };
  // Stub: no DB write in this test implementation; real implementation would insert stock_movements or wip_balance
  return { ok: true, message: 'WIP issue stub (test only)' };
}

/**
 * TEST: Get WIP balance for a production (stub).
 * Returns empty when flag off or no data.
 */
export async function getWipBalanceTest(
  productionId: string,
  companyId: string
): Promise<{ productId: string; quantity: number }[]> {
  const enabled = await featureFlagsService.isEnabled(companyId, FEATURE_KEYS.STUDIO_WIP_INVENTORY_TEST);
  if (!enabled) return [];
  return [];
}
