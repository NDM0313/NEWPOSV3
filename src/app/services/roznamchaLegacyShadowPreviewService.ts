/**
 * Roznamcha — legacy shadow preview loader (Phase 2.14).
 * Used when main table is unified; preview panel loads legacy for side-by-side compare.
 */

import type { RoznamchaResult } from '@/app/services/roznamchaService';
import {
  loadRoznamchaLegacyMain,
  type RoznamchaLegacyMainParams,
} from '@/app/services/roznamchaLegacyMainService';

export type RoznamchaLegacyShadowPreviewResult = {
  legacy: RoznamchaResult;
  closingBalance: number;
  openingBalance: number;
  compareSource: 'legacy_shadow';
};

export async function loadRoznamchaLegacyShadowPreview(
  params: RoznamchaLegacyMainParams,
): Promise<RoznamchaLegacyShadowPreviewResult> {
  const legacy = await loadRoznamchaLegacyMain(params);
  return {
    legacy,
    closingBalance: legacy.summary.closingBalance,
    openingBalance: legacy.summary.openingBalance,
    compareSource: 'legacy_shadow',
  };
}
