/**
 * Phase 3D — P&L preview compare source when main loader swaps.
 */

export type ProfitLossPreviewCompareSource = 'unified_compare' | 'legacy_shadow';

export function resolveProfitLossPreviewCompareSource(
  mainLoader: 'legacy' | 'unified',
): ProfitLossPreviewCompareSource {
  return mainLoader === 'unified' ? 'legacy_shadow' : 'unified_compare';
}
